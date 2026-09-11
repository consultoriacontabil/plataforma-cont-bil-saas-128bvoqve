import pb from '@/lib/pocketbase/client'
import type { EmpresaRegime, EmpresaPorte } from '@/types'

export interface EmpresaMigracaoLinhaItem {
  linha?: number
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  regime_tributario?: string
  porte?: string
  data_abertura?: string
  cnae?: string
  natureza_juridica?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  email?: string
  telefone?: string
  site?: string
  socios?: string
  honorarios_mensais?: number | string
  // Certificado digital informado na planilha
  certificado_validade?: string
  certificado_emissor?: string
  certificado_serie?: string
  observacoes?: string
}

export interface RelatorioLinhaMigracao {
  linha: number
  cnpj: string
  razao_social: string
  empresa_id?: string
  status: 'importada' | 'atualizada' | 'pulada' | 'erro'
  motivo: string
  tem_certificado?: boolean
  certificado_info?: string
}

export interface ExecutarMigracaoResult {
  success: boolean
  resumo: {
    totalLinhas: number
    importadas: number
    atualizadas: number
    puladas: number
    erros: number
    comCertificado?: number
    semCertificado?: number
  }
  relatorio: RelatorioLinhaMigracao[]
  migracaoId?: string
  mensagem?: string
}

export interface CertificadoVinculadoArquivo {
  arquivo: File
  cnpjAssociado: string
  nomeArquivo: string
  tamanho: number
  emissor?: string
  serie?: string
  validade?: string
}

export interface MigracaoLoteRecord {
  id: string
  tenant_id: string
  usuario_id?: string
  nome_arquivo: string
  modo_duplicidade: 'atualizar' | 'pular'
  total_linhas: number
  total_importadas: number
  total_atualizadas: number
  total_puladas: number
  total_erros: number
  relatorio_json?: RelatorioLinhaMigracao[]
  created: string
  updated: string
  expand?: {
    usuario_id?: { id: string; name: string; email: string }
  }
}

export const migracoesService = {
  /**
   * Executa importação de empresas no backend de forma segura
   */
  async executarMigracaoLote(params: {
    tenantId: string
    nomeArquivo: string
    modoDuplicidade: 'atualizar' | 'pular'
    empresas: EmpresaMigracaoLinhaItem[]
    certificadosArquivos?: CertificadoVinculadoArquivo[]
  }): Promise<ExecutarMigracaoResult> {
    const res = await pb.send<ExecutarMigracaoResult>('/backend/v1/empresas/migracao-lote', {
      method: 'POST',
      body: {
        tenant_id: params.tenantId,
        nome_arquivo: params.nomeArquivo,
        modo_duplicidade: params.modoDuplicidade,
        empresas: params.empresas,
      },
    })

    // Se houver arquivos .pfx anexados no assistente, fazer upload direto para as empresas importadas/atualizadas
    if (params.certificadosArquivos && params.certificadosArquivos.length > 0 && res.success) {
      const mapaEmpresasPorCnpj = new Map<string, string>()
      res.relatorio.forEach((r) => {
        if (r.empresa_id && r.cnpj) {
          const clean = r.cnpj.replace(/\D/g, '')
          mapaEmpresasPorCnpj.set(clean, r.empresa_id)
        }
      })

      for (const certItem of params.certificadosArquivos) {
        const cleanCnpj = certItem.cnpjAssociado.replace(/\D/g, '')
        const empresaId = mapaEmpresasPorCnpj.get(cleanCnpj)
        if (empresaId) {
          try {
            // Verificar se já existe registro de certificado criado
            const certsExistentes = await pb.collection('certificados_digitais').getList(1, 1, {
              filter: `tenant_id = "${params.tenantId}" && empresa = "${empresaId}"`,
              requestKey: null,
            })

            const formData = new FormData()
            formData.append('tenant_id', params.tenantId)
            formData.append('empresa', empresaId)
            formData.append('tipo', 'a1')
            formData.append('titular', `EMPRESA:${cleanCnpj}`)
            formData.append('arquivo_pfx', certItem.arquivo)
            formData.append('status', 'ativo')
            formData.append(
              'observacoes',
              `Certificado digital .pfx importado via migração em lote (${certItem.nomeArquivo}). Senha deve ser configurada na ficha da empresa.`,
            )
            if (certItem.emissor) formData.append('emissor', certItem.emissor)
            else if (!certsExistentes.items[0])
              formData.append('emissor', 'Autoridade Certificadora ICP-Brasil')

            if (certItem.serie) formData.append('numero_serie', certItem.serie)
            if (certItem.validade) {
              const v = certItem.validade.trim()
              let valIso = ''
              if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
                const parts = v.split('/')
                valIso = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T23:59:59Z`).toISOString()
              } else if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
                valIso = new Date(`${v.slice(0, 10)}T23:59:59Z`).toISOString()
              }
              if (valIso) formData.append('validade', valIso)
            } else if (!certsExistentes.items[0]) {
              // Data padrão de 1 ano se não informado na planilha
              const emUmAno = new Date()
              emUmAno.setFullYear(emUmAno.getFullYear() + 1)
              formData.append('validade', emUmAno.toISOString())
            }

            if (certsExistentes.items.length > 0) {
              await pb
                .collection('certificados_digitais')
                .update(certsExistentes.items[0].id, formData)
            } else {
              await pb.collection('certificados_digitais').create(formData)
            }

            // Atualiza status no relatório local
            const itemRel = res.relatorio.find((x) => x.cnpj.replace(/\D/g, '') === cleanCnpj)
            if (itemRel) {
              itemRel.tem_certificado = true
              itemRel.certificado_info = `Certificado .pfx anexado (${certItem.nomeArquivo})`
            }
          } catch (uploadErr) {
            console.warn(
              `Falha ao gravar arquivo de certificado para CNPJ ${cleanCnpj}:`,
              uploadErr,
            )
          }
        }
      }

      // Recalcula contagem final de certificados
      res.resumo.comCertificado = res.relatorio.filter((r) => r.tem_certificado).length
      res.resumo.semCertificado =
        res.resumo.importadas + res.resumo.atualizadas - (res.resumo.comCertificado || 0)
    }

    return res
  },

  /**
   * Lista o histórico de migrações em lote para auditoria
   */
  async listHistorico(tenantId: string): Promise<MigracaoLoteRecord[]> {
    return pb.collection('empresas_migracoes_lote').getFullList<MigracaoLoteRecord>({
      filter: `tenant_id = "${tenantId}"`,
      sort: '-created',
      expand: 'usuario_id',
    })
  },
}
