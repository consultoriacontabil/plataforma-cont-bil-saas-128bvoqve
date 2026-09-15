import pb from '@/lib/pocketbase/client'
import { auditService } from './audit'
import type { Empresa, ExclusaoEmpresaBackupRecord } from '@/types'

export interface ContagemVinculosEmpresa {
  colaboradores: number
  documentos: number
  titulosFinanceiros: number
  lancamentosContabeis: number
  obrigacoes: number
  certidoes: number
  guias: number
  parcelamentos: number
  nfse: number
  nfe: number
  contratos: number
  outros: number
  total: number
}

// Configuração das coleções filhas da empresa para contagem, backup e restauração
// campoEmpresa indica se a FK é 'empresa' ou 'empresa_id' ou similar
const REGRAS_COLECOES = [
  { collection: 'wa_atendimento_conversas', campo: 'empresa', label: 'Conversas WhatsApp' },
  { collection: 'nfse_notas_emitidas', campo: 'empresa', label: 'Notas NFS-e' },
  { collection: 'nfse_solicitacoes', campo: 'empresa', label: 'Solicitações NFS-e' },
  { collection: 'nfe_recebidas', campo: 'empresa', label: 'NF-e Recebidas' },
  { collection: 'nfe_config', campo: 'empresa', label: 'Configurações NF-e' },
  { collection: 'sped_arquivos', campo: 'empresa', label: 'Arquivos SPED' },
  { collection: 'certidoes', campo: 'empresa', label: 'Certidões CND' },
  { collection: 'ecac_comunicacoes', campo: 'empresa', label: 'Mensagens E-CAC' },
  { collection: 'rfb_config', campo: 'empresa', label: 'Configuração RFB' },
  { collection: 'guias_pagamentos', campo: 'empresa', label: 'Guias de Pagamento' },
  { collection: 'parcelamentos_federais', campo: 'empresa', label: 'Parcelamentos' },
  { collection: 'beneficios_concedidos', campo: 'empresa', label: 'Benefícios' },
  { collection: 'historico_salarial', campo: 'empresa', label: 'Histórico Salarial' },
  { collection: 'convencoes_coletivas', campo: 'empresa', label: 'Convenções Coletivas' },
  { collection: 'rescisoes', campo: 'empresa', label: 'Rescisões' },
  { collection: 'decimo_terceiro', campo: 'empresa', label: '13º Salário' },
  { collection: 'ferias_periodos', campo: 'empresa', label: 'Férias' },
  { collection: 'verbas_lancamentos', campo: 'empresa', label: 'Lançamentos de Verbas' },
  { collection: 'verbas_catalogo', campo: 'empresa', label: 'Catálogo de Verbas' },
  { collection: 'folha_pagamento', campo: 'empresa', label: 'Folhas de Pagamento' },
  { collection: 'eventos_dp', campo: 'empresa', label: 'Eventos DP' },
  { collection: 'esocial_eventos', campo: 'empresa', label: 'Eventos eSocial' },
  { collection: 'esocial_config', campo: 'empresa', label: 'Configuração eSocial' },
  { collection: 'reinf_eventos', campo: 'empresa', label: 'Eventos EFD-Reinf' },
  { collection: 'dctfweb_declaracoes', campo: 'empresa', label: 'Declarações DCTFWeb' },
  { collection: 'funcionarios', campo: 'empresa', label: 'Colaboradores' },
  { collection: 'simulacoes_reforma', campo: 'empresa', label: 'Simulações Reforma' },
  { collection: 'faturamentos_recorrentes', campo: 'empresa', label: 'Faturamentos Recorrentes' },
  { collection: 'assinaturas_demonstrativos', campo: 'empresa', label: 'Assinaturas' },
  { collection: 'contratos_honorarios', campo: 'empresa', label: 'Contratos' },
  { collection: 'impostos_retidos', campo: 'empresa', label: 'Impostos Retidos' },
  { collection: 'demonstrativos', campo: 'empresa', label: 'Demonstrativos' },
  { collection: 'pre_lancamentos', campo: 'empresa', label: 'Pré-lançamentos' },
  { collection: 'extratos_bancarios', campo: 'empresa', label: 'Extratos Bancários' },
  { collection: 'contas_financeiras', campo: 'empresa', label: 'Títulos Financeiros' },
  { collection: 'contas_bancarias', campo: 'empresa', label: 'Contas Bancárias' },
  { collection: 'baixas_ativos', campo: 'empresa', label: 'Baixas de Ativos' },
  { collection: 'ativos', campo: 'empresa', label: 'Ativos Imobilizados' },
  { collection: 'fechamento_checklist_itens', campo: 'empresa', label: 'Checklist de Fechamento' },
  { collection: 'fechamento_competencia', campo: 'empresa', label: 'Fechamento de Competência' },
  { collection: 'lancamentos_contabeis', campo: 'empresa', label: 'Lançamentos Contábeis' },
  { collection: 'fiscal', campo: 'empresa_id', label: 'Fiscal' },
  { collection: 'obrigacoes', campo: 'empresa_id', label: 'Obrigações' },
  { collection: 'workflows', campo: 'empresa_id', label: 'Workflows' },
  { collection: 'documentos', campo: 'empresa_id', label: 'Documentos' },
  { collection: 'certificados_digitais', campo: 'empresa', label: 'Certificados Digitais' },
  { collection: 'empresa_cadastro_assistido', campo: 'empresa', label: 'Cadastro Assistido' },
  { collection: 'whatsapp_leads_contatos', campo: 'empresa_associada', label: 'Leads WhatsApp' },
  { collection: 'portal_acessos', campo: 'empresa', label: 'Acessos Portal' },
]

export const exclusoesService = {
  /**
   * Lista backups com status e filtros
   */
  async list(tenantId: string, filter?: string, sort = '-criado_em') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('exclusoes_empresa_backup').getFullList<ExclusaoEmpresaBackupRecord>({
      filter: finalFilter,
      sort,
      expand: 'criado_por,restaurado_por',
    })
  },

  async getById(id: string) {
    return pb.collection('exclusoes_empresa_backup').getOne<ExclusaoEmpresaBackupRecord>(id, {
      expand: 'criado_por,restaurado_por',
    })
  },

  /**
   * Conta os registros derivados vinculados à empresa em todas as coleções
   */
  async contarVinculos(empresaId: string): Promise<ContagemVinculosEmpresa> {
    const contagem: ContagemVinculosEmpresa = {
      colaboradores: 0,
      documentos: 0,
      titulosFinanceiros: 0,
      lancamentosContabeis: 0,
      obrigacoes: 0,
      certidoes: 0,
      guias: 0,
      parcelamentos: 0,
      nfse: 0,
      nfe: 0,
      contratos: 0,
      outros: 0,
      total: 0,
    }

    try {
      const promises = REGRAS_COLECOES.map(async (r) => {
        try {
          const res = await pb.collection(r.collection).getList(1, 1, {
            filter: `${r.campo} = "${empresaId}"`,
            fields: 'id',
            requestKey: null,
          })
          return { col: r.collection, total: res.totalItems }
        } catch (_) {
          return { col: r.collection, total: 0 }
        }
      })

      const results = await Promise.all(promises)
      let somaTotal = 0

      for (const r of results) {
        somaTotal += r.total
        if (r.col === 'funcionarios') contagem.colaboradores = r.total
        else if (r.col === 'documentos') contagem.documentos = r.total
        else if (r.col === 'contas_financeiras') contagem.titulosFinanceiros = r.total
        else if (r.col === 'lancamentos_contabeis') contagem.lancamentosContabeis = r.total
        else if (r.col === 'obrigacoes') contagem.obrigacoes = r.total
        else if (r.col === 'certidoes') contagem.certidoes = r.total
        else if (r.col === 'guias_pagamentos') contagem.guias = r.total
        else if (r.col === 'parcelamentos_federais') contagem.parcelamentos = r.total
        else if (r.col === 'nfse_notas_emitidas') contagem.nfse = r.total
        else if (r.col === 'nfe_recebidas') contagem.nfe = r.total
        else if (r.col === 'contratos_honorarios') contagem.contratos = r.total
        else contagem.outros += r.total
      }

      contagem.total = somaTotal
    } catch (err) {
      console.warn('Erro ao contar vinculos da empresa:', err)
    }

    return contagem
  },

  /**
   * Gera o backup completo dos dados da empresa e seus filhos em JSON consolidado
   */
  async gerarBackupJson(empresa: Empresa): Promise<{
    dadosJson: Record<string, any[]>
    totalRegistros: number
    tamanhoBytes: number
  }> {
    const dadosJson: Record<string, any[]> = {}
    let totalRegistros = 1 // inclui a própria empresa
    dadosJson['empresas'] = [empresa]

    for (const r of REGRAS_COLECOES) {
      try {
        const registros = await pb.collection(r.collection).getFullList({
          filter: `${r.campo} = "${empresa.id}"`,
          requestKey: null,
        })
        if (registros && registros.length > 0) {
          dadosJson[r.collection] = registros
          totalRegistros += registros.length
        }
      } catch (err) {
        console.warn(`Aviso ao exportar registros da colecao ${r.collection}:`, err)
      }
    }

    // Também exportar mensagens de conversas do WhatsApp da empresa se houver conversas
    if (dadosJson['wa_atendimento_conversas'] && dadosJson['wa_atendimento_conversas'].length > 0) {
      const convIds = dadosJson['wa_atendimento_conversas'].map((c: any) => c.id)
      const msgs: any[] = []
      for (const cId of convIds) {
        try {
          const list = await pb.collection('wa_atendimento_mensagens').getFullList({
            filter: `conversa = "${cId}"`,
            requestKey: null,
          })
          msgs.push(...list)
        } catch {
          /* intentionally ignored */
        }
      }
      if (msgs.length > 0) {
        dadosJson['wa_atendimento_mensagens'] = msgs
        totalRegistros += msgs.length
      }
    }

    const str = JSON.stringify(dadosJson)
    const tamanhoBytes = new Blob([str]).size

    return {
      dadosJson,
      totalRegistros,
      tamanhoBytes,
    }
  },

  /**
   * Executa a exclusão com retenção de 24 horas:
   * 1. Gera o backup consolidado
   * 2. Salva o registro em exclusoes_empresa_backup (purga_em = now + 24h)
   * 3. Aplica soft-delete na empresa (excluida_em = now, status = 'encerrado')
   * 4. Registra no audit_log
   */
  async solicitarExclusaoComBackup(
    empresa: Empresa,
    usuarioId: string,
  ): Promise<ExclusaoEmpresaBackupRecord> {
    const now = new Date()
    const purgaEm = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // 1. Gerar backup
    const { dadosJson, totalRegistros, tamanhoBytes } = await this.gerarBackupJson(empresa)

    // 2. Gravar em exclusoes_empresa_backup
    const backupRecord = await pb
      .collection('exclusoes_empresa_backup')
      .create<ExclusaoEmpresaBackupRecord>({
        tenant_id: empresa.tenant_id,
        empresa_id: empresa.id,
        razao_social: empresa.razao_social,
        cnpj: empresa.cnpj,
        dados_json: dadosJson,
        total_registros: totalRegistros,
        tamanho_bytes: tamanhoBytes,
        criado_por: usuarioId && usuarioId !== 'system' ? usuarioId : null,
        criado_em: now.toISOString(),
        purga_em: purgaEm.toISOString(),
        status: 'retido',
      })

    // 3. Soft-delete na empresa (ocultando das listagens ativas)
    await pb.collection('empresas').update(empresa.id, {
      excluida_em: now.toISOString(),
      status: 'encerrado',
    })

    // 4. Auditoria
    await auditService.log(
      empresa.tenant_id,
      usuarioId,
      'Solicitação de exclusão de empresa com backup de 24h',
      'empresas',
      empresa.id,
      `Exclusão agendada para ${empresa.razao_social} (CNPJ: ${empresa.cnpj}). Backup retido: ${totalRegistros} registros (${(tamanhoBytes / 1024).toFixed(1)} KB). Purga definitiva em ${purgaEm.toLocaleString('pt-BR')}.`,
    )

    return backupRecord
  },

  /**
   * Restaura a empresa a partir do backup:
   * 1. Remove marca de soft-delete na empresa (excluida_em = "")
   * 2. Se a empresa foi excluída fisicamente, recria os registros do backup
   * 3. Marca status do backup como 'restaurado'
   * 4. Registra no audit_log
   */
  async restaurarBackup(backupId: string, usuarioId: string): Promise<void> {
    const backup = await this.getById(backupId)
    const now = new Date().toISOString()

    // Verificar se a empresa ainda existe no banco (soft-delete)
    let empresaExiste = false
    try {
      await pb.collection('empresas').getOne(backup.empresa_id)
      empresaExiste = true
    } catch (_) {
      empresaExiste = false
    }

    if (empresaExiste) {
      // Reativa a empresa removendo excluida_em
      await pb.collection('empresas').update(backup.empresa_id, {
        excluida_em: null,
        status: 'ativo',
      })
    } else {
      // Recriar a partir do JSON salvo se foi fisicamente apagada
      const dados = backup.dados_json || {}
      if (dados['empresas'] && dados['empresas'].length > 0) {
        const empData = { ...dados['empresas'][0] }
        delete empData.created
        delete empData.updated
        delete empData.excluida_em
        empData.status = 'ativo'
        await pb.collection('empresas').create(empData)
      }

      // Recriar registros filhos na ordem adequada
      for (let i = REGRAS_COLECOES.length - 1; i >= 0; i--) {
        const r = REGRAS_COLECOES[i]
        const items = dados[r.collection]
        if (Array.isArray(items)) {
          for (const item of items) {
            try {
              const payload = { ...item }
              delete payload.created
              delete payload.updated
              delete payload.expand
              await pb.collection(r.collection).create(payload)
            } catch (err) {
              console.warn(`Erro ao restaurar item em ${r.collection}:`, err)
            }
          }
        }
      }
    }

    // Atualizar registro de backup
    await pb.collection('exclusoes_empresa_backup').update(backupId, {
      status: 'restaurado',
      restaurado_em: now,
      restaurado_por: usuarioId && usuarioId !== 'system' ? usuarioId : null,
    })

    // Auditoria
    await auditService.log(
      backup.tenant_id,
      usuarioId,
      'Restauração de empresa a partir de backup',
      'empresas',
      backup.empresa_id,
      `Empresa ${backup.razao_social} (CNPJ: ${backup.cnpj}) restaurada com sucesso a partir do backup ${backupId}.`,
    )
  },

  /**
   * Purga definitiva imediata:
   * 1. Remove registros filhos fisicamente
   * 2. Remove registro da empresa fisicamente
   * 3. Atualiza o status do backup para 'purgado'
   * 4. Registra no audit_log
   */
  async purgarDefinitivamente(backupId: string, usuarioId: string): Promise<void> {
    const backup = await this.getById(backupId)
    const empresaId = backup.empresa_id
    const now = new Date().toISOString()

    // 1. Remover registros filhos
    for (const r of REGRAS_COLECOES) {
      try {
        const records = await pb.collection(r.collection).getFullList({
          filter: `${r.campo} = "${empresaId}"`,
          fields: 'id',
          requestKey: null,
        })
        for (const item of records) {
          try {
            await pb.collection(r.collection).delete(item.id)
          } catch {
            /* intentionally ignored */
          }
        }
      } catch {
        /* intentionally ignored */
      }
    }

    // 2. Remover empresa
    try {
      await pb.collection('empresas').delete(empresaId)
    } catch {
      /* intentionally ignored */
    }

    // 3. Atualizar status do backup
    await pb.collection('exclusoes_empresa_backup').update(backupId, {
      status: 'purgado',
      purgado_em: now,
    })

    // 4. Auditoria
    await auditService.log(
      backup.tenant_id,
      usuarioId,
      'Purga definitiva de empresa e dados vinculados',
      'empresas',
      empresaId,
      `Purga definitiva concluída para ${backup.razao_social} (CNPJ: ${backup.cnpj}). Registros filhos e cadastro excluídos de forma irrecuperável.`,
    )
  },
}
