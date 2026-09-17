import pb from '@/lib/pocketbase/client'
import type {
  CompanyFormationRecord,
  NaturezaJuridicaTipo,
  SocioAberturaItem,
  CnaesAberturaConfig,
  EtapaPipelineItem,
  ChecklistDocItem,
  Empresa,
  ObrigacaoRecord,
} from '@/types'
import { auditService } from '@/services/audit'
import { empresasService } from '@/services/empresas'
import {
  gerarTemplateEtapas,
  gerarTemplateChecklist,
  BASE_LEGAL_CITACAO,
} from '@/lib/companyFormationLegal'

export interface CreateFormationInput {
  tenant_id: string
  empresa: string
  natureza_juridica: NaturezaJuridicaTipo
  porte_pretendido?: Empresa['porte']
  regime_pretendido?: 'simples_nacional' | 'simei' | 'lucro_presumido' | 'lucro_real'
  capital_social_total?: number
  quotas_total?: number
  valor_nominal_quota?: number
  socios_json?: SocioAberturaItem[]
  cnaes_json?: CnaesAberturaConfig
  observacoes?: string
  responsavel?: string
}

export const companyFormationService = {
  /**
   * Busca o processo de abertura vinculado à empresa
   */
  async getByEmpresa(empresaId: string): Promise<CompanyFormationRecord | null> {
    try {
      const record = await pb
        .collection('company_formation')
        .getFirstListItem<CompanyFormationRecord>(`empresa = "${empresaId}"`, {
          expand: 'empresa,responsavel',
        })
      return record
    } catch (_) {
      return null
    }
  },

  /**
   * Inicia um novo processo de abertura para a empresa
   */
  async iniciarProcesso(
    empresa: Empresa,
    input: CreateFormationInput,
    usuarioId: string,
  ): Promise<CompanyFormationRecord> {
    const etapas = gerarTemplateEtapas()
    const temEstrangeiro = (input.socios_json || []).some((s) => s.residente_exterior)
    const checklist = gerarTemplateChecklist(input.natureza_juridica, temEstrangeiro)

    const payload: Partial<CompanyFormationRecord> = {
      tenant_id: input.tenant_id,
      empresa: input.empresa,
      natureza_juridica: input.natureza_juridica,
      porte_pretendido: input.porte_pretendido || empresa.porte || 'me',
      regime_pretendido:
        input.regime_pretendido ||
        (empresa.regime_tributario === 'mei'
          ? 'simei'
          : empresa.regime_tributario || 'simples_nacional'),
      status_processo: 'em_andamento',
      capital_social_total: input.capital_social_total || 10000,
      quotas_total: input.quotas_total || 10000,
      valor_nominal_quota: input.valor_nominal_quota || 1,
      socios_json: input.socios_json || [],
      cnaes_json: input.cnaes_json || {
        principal: { codigo: '', descricao: '' },
        secundarios: [],
      },
      etapas_json: etapas,
      documentos_checklist_json: checklist,
      base_legal_versao:
        'Marco Legal 2026 (Lei 13.874/19, CC arts. 982-1087, LC 123/06, Lei 14.195/21)',
      integracao_gerada: false,
      observacoes: input.observacoes || '',
      responsavel: input.responsavel || usuarioId || '',
    }

    const created = await pb.collection('company_formation').create<CompanyFormationRecord>(payload)

    // Auditoria
    await auditService.log(
      input.tenant_id,
      usuarioId,
      'Início do processo de abertura',
      'company_formation',
      created.id,
      `Iniciou constituição da empresa ${empresa.razao_social} sob a forma de ${input.natureza_juridica.toUpperCase()} (Capital: R$ ${payload.capital_social_total})`,
    )

    return created
  },

  /**
   * Atualiza os dados do processo de abertura
   */
  async update(
    id: string,
    data: Partial<CompanyFormationRecord>,
    usuarioId: string,
    tenantId: string,
    motivoLog?: string,
  ): Promise<CompanyFormationRecord> {
    const updated = await pb
      .collection('company_formation')
      .update<CompanyFormationRecord>(id, data)

    if (motivoLog) {
      await auditService.log(
        tenantId,
        usuarioId,
        'Atualização do processo de abertura',
        'company_formation',
        id,
        motivoLog,
      )
    }

    return updated
  },

  /**
   * Transfere dados concluídos do processo para a ficha cadastral fiscal da empresa
   */
  async gerarDadosFiscais(
    formation: CompanyFormationRecord,
    empresa: Empresa,
    usuarioId: string,
    dadosFiscais: {
      cnpj?: string
      inscricaoEstadual?: string
      inscricaoMunicipal?: string
      dataAbertura?: string
      regimeTributario?: Empresa['regime_tributario']
      porte?: Empresa['porte']
    },
  ): Promise<Empresa> {
    const updateEmpresaPayload: Partial<Empresa> = {
      status: 'ativo',
    }

    if (dadosFiscais.cnpj) updateEmpresaPayload.cnpj = dadosFiscais.cnpj.replace(/\D/g, '')
    if (dadosFiscais.inscricaoEstadual)
      updateEmpresaPayload.inscricao_estadual = dadosFiscais.inscricaoEstadual
    if (dadosFiscais.inscricaoMunicipal)
      updateEmpresaPayload.inscricao_municipal = dadosFiscais.inscricaoMunicipal
    if (dadosFiscais.dataAbertura) updateEmpresaPayload.data_abertura = dadosFiscais.dataAbertura
    if (dadosFiscais.regimeTributario)
      updateEmpresaPayload.regime_tributario = dadosFiscais.regimeTributario
    if (dadosFiscais.porte) updateEmpresaPayload.porte = dadosFiscais.porte

    // Atualiza empresa
    const updatedEmpresa = await empresasService.update(empresa.id, updateEmpresaPayload)

    // Atualiza formation como integrado
    await pb.collection('company_formation').update(formation.id, {
      integracao_gerada: true,
      dados_fiscais_integrados_em: new Date().toISOString(),
      status_processo: 'registrado_concluido',
    })

    // Registra auditoria
    await auditService.log(
      empresa.tenant_id,
      usuarioId,
      'Integração fiscal pós-abertura',
      'empresas',
      empresa.id,
      `Dados fiscais sincronizados a partir da conclusão do processo de abertura (CNPJ: ${dadosFiscais.cnpj || empresa.cnpj}).`,
    )

    return updatedEmpresa
  },

  /**
   * Cria as obrigações iniciais de implantação da empresa
   * (Inscrições municipais/estaduais, Simples Nacional, DCTFWeb, DAS, SPED, etc.)
   */
  async criarObrigacoesImplantacao(
    empresa: Empresa,
    formation: CompanyFormationRecord,
    usuarioId: string,
  ): Promise<{ totalCriadas: number; obrigacoes: ObrigacaoRecord[] }> {
    const anoAtual = new Date().getFullYear()
    const mesAtual = (new Date().getMonth() + 1).toString().padStart(2, '0')
    const competenciaPadrao = `${anoAtual}-${mesAtual}`

    const listaObrigacoesSugeridas: Array<{
      tipo: ObrigacaoRecord['tipo']
      observacoes: string
      vencimentoDias: number
      exigeCertificado: boolean
    }> = [
      {
        tipo: 'DAS',
        observacoes:
          'Guia do Simples Nacional / DAS referente à primeira competência de atividade.',
        vencimentoDias: 30,
        exigeCertificado: false,
      },
      {
        tipo: 'DCTF',
        observacoes: 'Declaração de Débitos e Créditos Tributários Federais (DCTFWeb mensal).',
        vencimentoDias: 25,
        exigeCertificado: true,
      },
      {
        tipo: 'EFD',
        observacoes: 'EFD-Reinf e Escrituração Fiscal Digital inicial.',
        vencimentoDias: 25,
        exigeCertificado: true,
      },
      {
        tipo: 'OUTROS',
        observacoes: 'Homologação e Confirmação de Enquadramento no Simples Nacional / Simei.',
        vencimentoDias: 15,
        exigeCertificado: true,
      },
    ]

    const criadas: ObrigacaoRecord[] = []

    for (const item of listaObrigacoesSugeridas) {
      const dataVenc = new Date()
      dataVenc.setDate(dataVenc.getDate() + item.vencimentoDias)
      const vencFormatado = dataVenc.toISOString().slice(0, 10)

      try {
        const obr = await pb.collection('obrigacoes').create<ObrigacaoRecord>({
          tenant_id: empresa.tenant_id,
          empresa_id: empresa.id,
          tipo: item.tipo,
          competencia: competenciaPadrao,
          vencimento: vencFormatado,
          status: 'pendente',
          responsavel_id: usuarioId && usuarioId !== 'system' ? usuarioId : null,
          observacoes: `[Implantação / Abertura]: ${item.observacoes}`,
          exige_certificado: item.exigeCertificado,
        })
        criadas.push(obr)
      } catch (err) {
        console.warn('Erro ao criar obrigação de implantação:', err)
      }
    }

    // Auditoria
    await auditService.log(
      empresa.tenant_id,
      usuarioId,
      'Criação de obrigações de implantação',
      'company_formation',
      formation.id,
      `Criadas ${criadas.length} obrigações contábeis e fiscais de início de atividade para ${empresa.razao_social}.`,
    )

    return { totalCriadas: criadas.length, obrigacoes: criadas }
  },
}
