import pb from '@/lib/pocketbase/client'
import type {
  CompanyOnboardingWorkflowRecord,
  OnboardingChecklistItem,
  StatusItemChecklistOnboarding,
  StatusOnboardingWorkflow,
  DadosPreliminaresOnboarding,
  NaturezaJuridicaTipo,
  Empresa,
  ItemCheckPassoAbertura,
} from '@/types'
import { auditService } from '@/services/audit'
import { inicializarChecklistPassos } from '@/lib/passosAberturaConfig'
import { notificacoesService } from '@/services/notificacoes'
import { gerarTemplateEtapas, gerarTemplateChecklist } from '@/lib/companyFormationLegal'

export interface CreateOnboardingWorkflowInput {
  tenant_id: string
  empresa_id?: string
  solicitante_id?: string
  titulo: string
  razao_social_pretendida?: string
  nome_fantasia_pretendido?: string
  natureza_juridica?: NaturezaJuridicaTipo
  porte_pretendido?: CompanyOnboardingWorkflowRecord['porte_pretendido']
  regime_pretendido?: CompanyOnboardingWorkflowRecord['regime_pretendido']
  cliente_nome?: string
  cliente_email?: string
  cliente_telefone?: string
  expira_em?: string
  observacoes?: string
  checklist_personalizado?: OnboardingChecklistItem[]
}

/**
 * Gera token único com 32 caracteres criptograficamente fortes
 */
export function generateWorkflowToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = 'ABR-'
  const array = new Uint8Array(28)
  window.crypto.getRandomValues(array)
  for (let i = 0; i < array.length; i++) {
    token += chars[array[i] % chars.length]
  }
  return token
}

export const companyOnboardingService = {
  /**
   * Lista todos os workflows do tenant (acesso autenticado)
   */
  async list(tenantId: string): Promise<CompanyOnboardingWorkflowRecord[]> {
    return pb
      .collection('company_onboarding_workflow')
      .getFullList<CompanyOnboardingWorkflowRecord>({
        filter: `tenant_id = "${tenantId}"`,
        sort: '-created',
        expand: 'empresa_id,solicitante_id',
      })
  },

  /**
   * Busca workflow por ID
   */
  async getById(id: string): Promise<CompanyOnboardingWorkflowRecord> {
    return pb
      .collection('company_onboarding_workflow')
      .getOne<CompanyOnboardingWorkflowRecord>(id, {
        expand: 'empresa_id,solicitante_id,tenant_id',
      })
  },

  /**
   * Busca workflow pelo token público (para página externa /abertura/:token)
   */
  async getByToken(token: string): Promise<CompanyOnboardingWorkflowRecord | null> {
    try {
      const cleanToken = token.trim()
      const record = await pb
        .collection('company_onboarding_workflow')
        .getFirstListItem<CompanyOnboardingWorkflowRecord>(`token = "${cleanToken}"`, {
          expand: 'empresa_id,tenant_id',
        })
      return record
    } catch (_) {
      return null
    }
  },

  /**
   * Cria novo workflow de abertura e gera token do link público
   */
  async create(
    input: CreateOnboardingWorkflowInput,
    usuarioId: string,
  ): Promise<CompanyOnboardingWorkflowRecord> {
    const etapas = gerarTemplateEtapas()
    const natureza = input.natureza_juridica || 'slu'
    const checklistBase = input.checklist_personalizado || gerarTemplateChecklist(natureza, false)

    // Converte os itens para o formato OnboardingChecklistItem
    const checklistDocs: OnboardingChecklistItem[] = checklistBase.map((item) => ({
      id: item.id,
      titulo: item.titulo,
      categoria: item.categoria,
      obrigatorio: item.obrigatorio,
      status: 'pendente' as StatusItemChecklistOnboarding,
      detalhe: item.detalhe,
      ged_documento_id: item.ged_documento_id,
      nome_arquivo: item.nome_arquivo,
    }))

    const token = generateWorkflowToken()

    const payload: Partial<CompanyOnboardingWorkflowRecord> = {
      tenant_id: input.tenant_id,
      empresa_id: input.empresa_id || undefined,
      solicitante_id: usuarioId || input.solicitante_id || undefined,
      titulo: input.titulo,
      razao_social_pretendida: input.razao_social_pretendida || '',
      nome_fantasia_pretendido: input.nome_fantasia_pretendido || '',
      natureza_juridica: natureza,
      porte_pretendido: input.porte_pretendido || 'me',
      regime_pretendido: input.regime_pretendido || 'simples_nacional',
      status: 'aguardando_cliente',
      pipeline_etapas_json: etapas,
      checklist_docs_json: checklistDocs,
      dados_preliminares_json: {
        razao_social_pretendida: input.razao_social_pretendida || '',
        nome_fantasia_pretendido: input.nome_fantasia_pretendido || '',
        natureza_juridica: natureza,
        socios: [],
      },
      token,
      link_ativo: true,
      expira_em: input.expira_em || undefined,
      cliente_nome: input.cliente_nome || '',
      cliente_email: input.cliente_email || '',
      cliente_telefone: input.cliente_telefone || '',
      observacoes: input.observacoes || '',
      checklist_passos_json: inicializarChecklistPassos(),
    }

    const created = await pb
      .collection('company_onboarding_workflow')
      .create<CompanyOnboardingWorkflowRecord>(payload)

    // Auditoria
    await auditService.log(
      input.tenant_id,
      usuarioId,
      'Criação de workflow de abertura',
      'company_onboarding_workflow',
      created.id,
      `Criado workflow "${created.titulo}" para ${created.razao_social_pretendida || 'nova empresa'}. Token gerado.`,
    )

    return created
  },

  /**
   * Regenera o token do link público
   */
  async regenerarToken(
    workflowId: string,
    usuarioId: string,
    tenantId: string,
  ): Promise<CompanyOnboardingWorkflowRecord> {
    const novoToken = generateWorkflowToken()
    const updated = await pb
      .collection('company_onboarding_workflow')
      .update<CompanyOnboardingWorkflowRecord>(workflowId, {
        token: novoToken,
        link_ativo: true,
      })

    await auditService.log(
      tenantId,
      usuarioId,
      'Regeneração de link público de abertura',
      'company_onboarding_workflow',
      workflowId,
      `Link público regenerado. Novo token: ${novoToken.slice(0, 8)}...`,
    )

    return updated
  },

  /**
   * Revoga ou reativa o link público
   */
  async alternarLinkAtivo(
    workflowId: string,
    ativo: boolean,
    usuarioId: string,
    tenantId: string,
  ): Promise<CompanyOnboardingWorkflowRecord> {
    const updated = await pb
      .collection('company_onboarding_workflow')
      .update<CompanyOnboardingWorkflowRecord>(workflowId, {
        link_ativo: ativo,
      })

    await auditService.log(
      tenantId,
      usuarioId,
      ativo ? 'Reativação de link público de abertura' : 'Revogação de link público de abertura',
      'company_onboarding_workflow',
      workflowId,
      `Link público de abertura ${ativo ? 'reativado' : 'revogado'}.`,
    )

    return updated
  },

  /**
   * Contador aprova um documento do checklist
   */
  async aprovarDocumento(
    workflowId: string,
    itemId: string,
    usuarioId: string,
    tenantId: string,
  ): Promise<CompanyOnboardingWorkflowRecord> {
    const wf = await this.getById(workflowId)
    const checklist = [...(wf.checklist_docs_json || [])]
    const index = checklist.findIndex((it) => it.id === itemId)
    if (index === -1) throw new Error('Item do checklist não encontrado.')

    checklist[index] = {
      ...checklist[index],
      status: 'aprovado',
      revisado_em: new Date().toISOString(),
      motivo_recusa: '',
    }

    // Se todos os obrigatórios estiverem aprovados, verificar se podemos sugerir ou atualizar status
    const todosObrigatoriosAprovados = checklist
      .filter((it) => it.obrigatorio)
      .every((it) => it.status === 'aprovado')

    const novoStatus: StatusOnboardingWorkflow = todosObrigatoriosAprovados
      ? 'em_andamento'
      : wf.status

    const updated = await pb
      .collection('company_onboarding_workflow')
      .update<CompanyOnboardingWorkflowRecord>(workflowId, {
        checklist_docs_json: checklist,
        status: novoStatus,
      })

    await auditService.log(
      tenantId,
      usuarioId,
      'Aprovação de documento de abertura',
      'company_onboarding_workflow',
      workflowId,
      `Item "${checklist[index].titulo}" foi aprovado pelo contador.`,
    )

    return updated
  },

  /**
   * Contador recusa um documento com justificativa clara
   */
  async recusarDocumento(
    workflowId: string,
    itemId: string,
    motivo: string,
    usuarioId: string,
    tenantId: string,
  ): Promise<CompanyOnboardingWorkflowRecord> {
    if (!motivo.trim()) throw new Error('O motivo da recusa é obrigatório.')

    const wf = await this.getById(workflowId)
    const checklist = [...(wf.checklist_docs_json || [])]
    const index = checklist.findIndex((it) => it.id === itemId)
    if (index === -1) throw new Error('Item do checklist não encontrado.')

    checklist[index] = {
      ...checklist[index],
      status: 'recusado',
      revisado_em: new Date().toISOString(),
      motivo_recusa: motivo.trim(),
    }

    const updated = await pb
      .collection('company_onboarding_workflow')
      .update<CompanyOnboardingWorkflowRecord>(workflowId, {
        checklist_docs_json: checklist,
        status: 'aguardando_cliente', // Volta para o cliente corrigir
      })

    await auditService.log(
      tenantId,
      usuarioId,
      'Recusa de documento de abertura',
      'company_onboarding_workflow',
      workflowId,
      `Item "${checklist[index].titulo}" foi recusado. Motivo: ${motivo.trim()}`,
    )

    return updated
  },

  /**
   * Atualização geral do workflow (status, pipeline, dados preliminares)
   */
  async update(
    workflowId: string,
    data: Partial<CompanyOnboardingWorkflowRecord>,
    usuarioId?: string,
    tenantId?: string,
    auditMsg?: string,
  ): Promise<CompanyOnboardingWorkflowRecord> {
    const updated = await pb
      .collection('company_onboarding_workflow')
      .update<CompanyOnboardingWorkflowRecord>(workflowId, data)

    if (auditMsg && tenantId && usuarioId) {
      await auditService.log(
        tenantId,
        usuarioId,
        'Atualização de workflow de abertura',
        'company_onboarding_workflow',
        workflowId,
        auditMsg,
      )
    }

    return updated
  },

  /**
   * Atualiza ou alterna um item do Check dos Passos da Abertura
   */
  async alternarItemPasso(
    workflowId: string,
    itemId: string,
    marcado: boolean,
    usuarioId: string,
    usuarioNome: string,
    tenantId: string,
    dadosAuxiliares?: {
      protocolo_viabilidade?: string
      nire?: string
      data_efetivacao_cnpj?: string
      observacao?: string
    },
  ): Promise<CompanyOnboardingWorkflowRecord> {
    const wf = await this.getById(workflowId)
    const passos = inicializarChecklistPassos(wf.checklist_passos_json)
    const index = passos.findIndex((p) => p.id === itemId)
    if (index === -1) throw new Error('Item dos passos não encontrado.')

    const itemAnterior = passos[index]
    const novoItem: ItemCheckPassoAbertura = {
      ...itemAnterior,
      concluido: marcado,
      concluido_em: marcado ? new Date().toISOString() : undefined,
      concluido_por_id: marcado ? usuarioId : undefined,
      concluido_por_nome: marcado ? usuarioNome : undefined,
    }

    if (dadosAuxiliares) {
      if (dadosAuxiliares.protocolo_viabilidade !== undefined) {
        novoItem.protocolo_viabilidade = dadosAuxiliares.protocolo_viabilidade
      }
      if (dadosAuxiliares.nire !== undefined) {
        novoItem.nire = dadosAuxiliares.nire
      }
      if (dadosAuxiliares.data_efetivacao_cnpj !== undefined) {
        novoItem.data_efetivacao_cnpj = dadosAuxiliares.data_efetivacao_cnpj
      }
      if (dadosAuxiliares.observacao !== undefined) {
        novoItem.observacao = dadosAuxiliares.observacao
      }
    }

    passos[index] = novoItem

    const updated = await pb
      .collection('company_onboarding_workflow')
      .update<CompanyOnboardingWorkflowRecord>(workflowId, {
        checklist_passos_json: passos,
      })

    const acaoTexto = marcado ? 'Marcar passo da abertura' : 'Desmarcar passo da abertura'
    const detalhes = `Passo ${itemAnterior.numero} (${itemAnterior.passoTitulo}): "${itemAnterior.texto.slice(0, 60)}..." ${
      marcado ? 'marcado como concluído' : 'desmarcado'
    } por ${usuarioNome || usuarioId}.${
      novoItem.protocolo_viabilidade ? ` Protocolo: ${novoItem.protocolo_viabilidade}.` : ''
    }${novoItem.nire ? ` NIRE: ${novoItem.nire}.` : ''}`

    await auditService.log(
      tenantId,
      usuarioId,
      acaoTexto,
      'company_onboarding_workflow',
      workflowId,
      detalhes,
    )

    return updated
  },

  /**
   * Salva os campos auxiliares inline de um item do passo (protocolo, nire, data efetivação)
   */
  async salvarCamposAuxiliaresPasso(
    workflowId: string,
    itemId: string,
    campos: {
      protocolo_viabilidade?: string
      nire?: string
      data_efetivacao_cnpj?: string
      observacao?: string
    },
    usuarioId: string,
    usuarioNome: string,
    tenantId: string,
  ): Promise<CompanyOnboardingWorkflowRecord> {
    const wf = await this.getById(workflowId)
    const passos = inicializarChecklistPassos(wf.checklist_passos_json)
    const index = passos.findIndex((p) => p.id === itemId)
    if (index === -1) throw new Error('Item dos passos não encontrado.')

    passos[index] = {
      ...passos[index],
      ...campos,
    }

    const updated = await pb
      .collection('company_onboarding_workflow')
      .update<CompanyOnboardingWorkflowRecord>(workflowId, {
        checklist_passos_json: passos,
      })

    await auditService.log(
      tenantId,
      usuarioId,
      'Atualização de dados auxiliares do passo',
      'company_onboarding_workflow',
      workflowId,
      `Anotações salvas no item ${passos[index].numero} (${passos[index].passoTitulo}) por ${usuarioNome || usuarioId}.`,
    )

    return updated
  },

  /**
   * Upload de documento feito pelo CLIENTE através do link público
   * Grava na coleção 'documentos' (GED) com origem 'link_publico' e vincula ao checklist
   */
  async uploadDocumentoPublico(
    workflow: CompanyOnboardingWorkflowRecord,
    itemId: string,
    file: File,
  ): Promise<CompanyOnboardingWorkflowRecord> {
    // 1. Criar registro no GED
    const formData = new FormData()
    formData.append('tenant_id', workflow.tenant_id)
    if (workflow.empresa_id) {
      formData.append('empresa_id', workflow.empresa_id)
    }
    formData.append('nome_arquivo', file.name)
    formData.append('tipo', 'contrato_social')
    formData.append('status', 'processado')
    formData.append('origem_documento', 'link_publico')
    formData.append(
      'observacoes',
      `[Link Público de Abertura]: Documento "${file.name}" enviado pelo cliente via token ${workflow.token.slice(0, 8)}...`,
    )
    formData.append('arquivo', file)

    const docCreated = await pb.collection('documentos').create(formData)
    const arquivoUrl = pb.files.getURL(docCreated, docCreated.arquivo)

    // 2. Atualizar item do checklist
    const checklist = [...(workflow.checklist_docs_json || [])]
    const index = checklist.findIndex((it) => it.id === itemId)
    if (index === -1) throw new Error('Item de checklist inválido.')

    checklist[index] = {
      ...checklist[index],
      status: 'enviado',
      ged_documento_id: docCreated.id,
      nome_arquivo: file.name,
      arquivo_url: arquivoUrl,
      enviado_em: new Date().toISOString(),
      motivo_recusa: '',
    }

    // 3. Atualiza o workflow: status passa a 'em_analise' para a equipe contábil revisar
    const updatedWf = await pb
      .collection('company_onboarding_workflow')
      .update<CompanyOnboardingWorkflowRecord>(workflow.id, {
        checklist_docs_json: checklist,
        status: 'em_analise',
        token: workflow.token, // enviado no body para satisfazer a updateRule pública
      })

    // 4. Auditoria de envio via link público
    await auditService.log(
      workflow.tenant_id,
      'cliente_publico',
      'Envio de documento via link público',
      'company_onboarding_workflow',
      workflow.id,
      `Cliente enviou o documento "${file.name}" para o item "${checklist[index].titulo}".`,
    )

    // 5. Notificação interna para a equipe
    try {
      await notificacoesService.criarNotificacao({
        tenant_id: workflow.tenant_id,
        titulo: 'Documento recebido de cliente',
        mensagem: `Novo arquivo "${file.name}" anexado no workflow de abertura "${workflow.razao_social_pretendida || workflow.titulo}".`,
        tipo: 'workflow_status',
        link: '/workflow',
      })
    } catch {
      /* intentionally ignored */
    }

    return updatedWf
  },

  /**
   * Salva os dados preliminares preenchidos pelo cliente no link público
   */
  async salvarDadosPreliminaresPublico(
    workflow: CompanyOnboardingWorkflowRecord,
    dados: DadosPreliminaresOnboarding,
    clienteInfo?: { nome?: string; email?: string; telefone?: string },
  ): Promise<CompanyOnboardingWorkflowRecord> {
    const updatePayload: Partial<CompanyOnboardingWorkflowRecord> = {
      dados_preliminares_json: dados,
      token: workflow.token,
    }

    if (dados.razao_social_pretendida) {
      updatePayload.razao_social_pretendida = dados.razao_social_pretendida
    }
    if (dados.nome_fantasia_pretendido) {
      updatePayload.nome_fantasia_pretendido = dados.nome_fantasia_pretendido
    }
    if (dados.natureza_juridica) {
      updatePayload.natureza_juridica = dados.natureza_juridica
    }
    if (clienteInfo?.nome) updatePayload.cliente_nome = clienteInfo.nome
    if (clienteInfo?.email) updatePayload.cliente_email = clienteInfo.email
    if (clienteInfo?.telefone) updatePayload.cliente_telefone = clienteInfo.telefone

    const updated = await pb
      .collection('company_onboarding_workflow')
      .update<CompanyOnboardingWorkflowRecord>(workflow.id, updatePayload)

    await auditService.log(
      workflow.tenant_id,
      'cliente_publico',
      'Atualização de dados da empresa pelo cliente',
      'company_onboarding_workflow',
      workflow.id,
      `Cliente preencheu dados da futura empresa: ${dados.razao_social_pretendida || 'Sem razão social'}.`,
    )

    return updated
  },

  /**
   * Conclui o workflow e cria a ficha definitiva da empresa se ela ainda não existia
   */
  async concluirECriarEmpresa(
    workflow: CompanyOnboardingWorkflowRecord,
    usuarioId: string,
  ): Promise<{ empresa: Empresa; workflow: CompanyOnboardingWorkflowRecord }> {
    let empresaAlvo: Empresa

    if (workflow.empresa_id) {
      empresaAlvo = await pb.collection('empresas').getOne<Empresa>(workflow.empresa_id)
    } else {
      // Cria a nova empresa a partir dos dados preliminares
      const dados = workflow.dados_preliminares_json || {}
      empresaAlvo = await pb.collection('empresas').create<Empresa>({
        tenant_id: workflow.tenant_id,
        razao_social:
          dados.razao_social_pretendida || workflow.razao_social_pretendida || workflow.titulo,
        nome_fantasia:
          dados.nome_fantasia_pretendido ||
          workflow.nome_fantasia_pretendido ||
          dados.razao_social_pretendida ||
          workflow.titulo,
        cnpj: dados.cnpj_pretendido?.replace(/\D/g, '') || '',
        regime_tributario: workflow.regime_pretendido || 'simples_nacional',
        porte: workflow.porte_pretendido || 'me',
        status: 'ativo',
        email: workflow.cliente_email || '',
        telefone: workflow.cliente_telefone || '',
      })
    }

    const updatedWf = await pb
      .collection('company_onboarding_workflow')
      .update<CompanyOnboardingWorkflowRecord>(workflow.id, {
        status: 'concluido',
        empresa_id: empresaAlvo.id,
      })

    await auditService.log(
      workflow.tenant_id,
      usuarioId,
      'Conclusão do workflow de abertura',
      'company_onboarding_workflow',
      workflow.id,
      `Workflow concluído com sucesso e vinculado à empresa ${empresaAlvo.razao_social}.`,
    )

    return { empresa: empresaAlvo, workflow: updatedWf }
  },
}
