import pb from '@/lib/pocketbase/client'
import { auditService } from '@/services/audit'
import { documentosService } from '@/services/documentos'
import type {
  EmpresaMigracaoOnboardingRecord,
  ItemChecklistMigracao,
  MigracaoTipo,
  MigracaoStatus,
  HistoricoMigracaoAtividade,
} from '@/types'

export const ITENS_PADRAO_MIGRACAO_ENTRADA: Array<
  Omit<ItemChecklistMigracao, 'id' | 'concluido' | 'concluido_em'>
> = [
  {
    codigo: 'ENT_01',
    titulo: 'Contratação, Honorários e Termo de Transferência',
    descricao:
      'Formalização da proposta aceita, contrato de prestação de serviços contábeis e assinatura do Termo de Responsabilidade Técnica.',
    categoria: 'contrato_honorarios',
    obrigatorio: true,
  },
  {
    codigo: 'ENT_02',
    titulo: 'Procurações Eletrônicas (e-CAC RFB, SEFAZ, Prefeitura)',
    descricao:
      'Outorga e validação das procurações no portal e-CAC da Receita Federal, SEFAZ estadual e Secretaria de Finanças Municipal.',
    categoria: 'procuracoes',
    obrigatorio: true,
  },
  {
    codigo: 'ENT_03',
    titulo: 'Coleta de Arquivos e Históricos do Contador Anterior',
    descricao:
      'Obtenção dos balancetes analíticos, demonstrativos DRE/BP, arquivos SPED (ECD, ECF, EFD Contribuições/ICMS), folhas de pagamento e certidões emitidas.',
    categoria: 'arquivos_anteriores',
    obrigatorio: true,
  },
  {
    codigo: 'ENT_04',
    titulo: 'Certificado Digital e-CNPJ/e-CPF A1 e Senhas de Portais',
    descricao:
      'Instalação/upload do certificado digital A1 (.pfx) com respectiva senha e mapeamento das senhas de acesso aos portais (eSocial, Conectividade, Simples Nacional, prefeitura).',
    categoria: 'certificados_senhas',
    obrigatorio: true,
  },
  {
    codigo: 'ENT_05',
    titulo: 'Cadastros e Inscrições (Municipal, Estadual e CNAEs)',
    descricao:
      'Validação da situação cadastral do CNPJ na RFB, Inscrição Estadual (SINTEGRA/CCC), Inscrição Municipal (CCM/Alvará) e enquadramento das atividades CNAE.',
    categoria: 'cadastros_fiscais',
    obrigatorio: true,
  },
  {
    codigo: 'ENT_06',
    titulo: 'Conferência de Pendências Fiscais e Parcelamentos Herdados',
    descricao:
      'Diagnóstico de débitos em aberto, autos de infração e acompanhamento de parcelamentos federais/previdenciários herdados da gestão anterior.',
    categoria: 'pendencias_parcelamentos',
    obrigatorio: true,
  },
  {
    codigo: 'ENT_07',
    titulo: 'Implantação de Saldos Iniciais e Plano de Contas',
    descricao:
      'Lançamento dos saldos de abertura das contas do Ativo, Passivo e Patrimônio Líquido com base no último balancete oficial homologado.',
    categoria: 'saldos_contabeis',
    obrigatorio: true,
  },
  {
    codigo: 'ENT_08',
    titulo: 'Definição e Validação do Regime Tributário',
    descricao:
      'Confirmação do enquadramento tributário (Simples Nacional, Lucro Presumido, Lucro Real ou MEI) e limites de faturamento / sublimites.',
    categoria: 'regime_tributario',
    obrigatorio: true,
  },
  {
    codigo: 'ENT_09',
    titulo: 'Data de Corte e Início da Responsabilidade Técnica',
    descricao:
      'Fixação formal da data de corte e determinação da primeira competência de apuração mensal sob responsabilidade contábil deste escritório.',
    categoria: 'data_corte',
    obrigatorio: true,
  },
]

export const ITENS_PADRAO_MIGRACAO_SAIDA: Array<
  Omit<ItemChecklistMigracao, 'id' | 'concluido' | 'concluido_em'>
> = [
  {
    codigo: 'SAI_01',
    titulo: 'Competências Transmitidas e Fechamento até a Data de Corte',
    descricao:
      'Conferência e transmissão de todas as obrigações acessórias, apurações fiscais e folhas de pagamento até a competência final acordada.',
    categoria: 'declaracoes_fiscais',
    obrigatorio: true,
  },
  {
    codigo: 'SAI_02',
    titulo: 'Arquivos a Entregar ao Novo Contador (SPEDs, DRE, Folha, Guias)',
    descricao:
      'Organização do pacote digital contendo SPED ECD, ECF, EFDs, livro diário/razão, relatórios contábeis, guias de recolhimento pagas e demonstrativos.',
    categoria: 'handover_arquivos',
    obrigatorio: true,
  },
  {
    codigo: 'SAI_03',
    titulo: 'Termo de Transferência de Responsabilidade Técnica (Distrato)',
    descricao:
      'Elaboração e assinatura bilateral do Termo de Transferência de Responsabilidade Técnica conforme normas do CFC / CRC.',
    categoria: 'termo_responsabilidade',
    obrigatorio: true,
  },
  {
    codigo: 'SAI_04',
    titulo: 'Revogação de Procurações Eletrônicas (e-CAC, SEFAZ, Município)',
    descricao:
      'Cancelamento formal ou renúncia das procurações eletrônicas emitidas em nome do escritório ou dos contadores responsáveis.',
    categoria: 'revogacao_acessos',
    obrigatorio: true,
  },
  {
    codigo: 'SAI_05',
    titulo: 'Cancelamento e Desativação de Acessos Compartilhados',
    descricao:
      'Desativação das credenciais de sistemas internos, integrações bancárias, conexões SEFAZ e acessos a portais operacionais da empresa.',
    categoria: 'revogacao_acessos',
    obrigatorio: true,
  },
  {
    codigo: 'SAI_06',
    titulo: 'Regularização de Pendências e Acertos Financeiros Pré-Saída',
    descricao:
      'Verificação de eventuais honorários contábeis residuais ou pendências documentais antes da finalização do processo de saída.',
    categoria: 'pendencias_parcelamentos',
    obrigatorio: false,
  },
]

export interface CriarProcessoMigracaoInput {
  tenant_id: string
  empresa_id: string
  tipo: MigracaoTipo
  responsavel_id?: string
  data_inicio?: string
  data_corte?: string
  primeira_competencia?: string
  contador_anterior?: string
  novo_contador?: string
  contato_outro_contador?: string
  regime_tributario_definido?: string
  motivo_saida?: string
  observacoes?: string
}

export const empresasMigracoesOnboardingService = {
  /**
   * Lista todos os processos de migração do tenant com filtros opcionais
   */
  async list(
    tenantId: string,
    filter?: string,
    sort = '-created',
  ): Promise<EmpresaMigracaoOnboardingRecord[]> {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`

    return pb
      .collection('empresas_migracoes_onboarding')
      .getFullList<EmpresaMigracaoOnboardingRecord>({
        filter: finalFilter,
        sort,
        expand: 'empresa_id,responsavel_id,concluido_por_id,contrato_honorario_id',
      })
  },

  /**
   * Vincula ou desvincula um contrato/proposta de honorários ao processo de migração
   */
  async vincularContrato(
    processoId: string,
    contratoId: string | null,
    usuarioId?: string,
    tenantId?: string,
  ): Promise<EmpresaMigracaoOnboardingRecord> {
    const updated = await pb
      .collection('empresas_migracoes_onboarding')
      .update<EmpresaMigracaoOnboardingRecord>(
        processoId,
        {
          contrato_honorario_id: contratoId,
        },
        {
          expand: 'empresa_id,responsavel_id,concluido_por_id,contrato_honorario_id',
        },
      )

    if (tenantId && usuarioId) {
      await auditService.log(
        tenantId,
        usuarioId,
        contratoId ? 'Vincular Contrato à Migração' : 'Desvincular Contrato da Migração',
        'empresas_migracoes_onboarding',
        processoId,
        contratoId
          ? `Processo de migração vinculado à proposta/contrato ${contratoId}.`
          : 'Processo de migração desvinculado de contrato.',
      )
    }

    return updated
  },

  /**
   * Busca um processo específico por ID
   */
  async getById(id: string): Promise<EmpresaMigracaoOnboardingRecord> {
    return pb
      .collection('empresas_migracoes_onboarding')
      .getOne<EmpresaMigracaoOnboardingRecord>(id, {
        expand: 'empresa_id,responsavel_id,concluido_por_id',
      })
  },

  /**
   * Busca processo ativo de uma empresa específica (por tipo ou qualquer tipo)
   */
  async getAtivoByEmpresa(
    tenantId: string,
    empresaId: string,
    tipo?: MigracaoTipo,
  ): Promise<EmpresaMigracaoOnboardingRecord | null> {
    let filter = `tenant_id = "${tenantId}" && empresa_id = "${empresaId}" && status != "cancelado" && status != "concluido"`
    if (tipo) filter += ` && tipo = "${tipo}"`

    try {
      const res = await pb
        .collection('empresas_migracoes_onboarding')
        .getList<EmpresaMigracaoOnboardingRecord>(1, 1, {
          filter,
          sort: '-created',
          expand: 'empresa_id,responsavel_id',
        })
      return res.items[0] || null
    } catch {
      return null
    }
  },

  /**
   * Retorna um mapa rápido de processos ativos por empresa para visualização direta na carteira
   */
  async getMapaProcessosAtivos(
    tenantId: string,
  ): Promise<
    Record<string, { id: string; tipo: MigracaoTipo; status: MigracaoStatus; data_corte?: string }>
  > {
    try {
      const records = await pb
        .collection('empresas_migracoes_onboarding')
        .getFullList<EmpresaMigracaoOnboardingRecord>({
          filter: `tenant_id = "${tenantId}" && status != "cancelado" && status != "concluido"`,
          fields: 'id,empresa_id,tipo,status,data_corte',
        })
      const map: Record<
        string,
        { id: string; tipo: MigracaoTipo; status: MigracaoStatus; data_corte?: string }
      > = {}
      records.forEach((r) => {
        if (r.empresa_id && !map[r.empresa_id]) {
          map[r.empresa_id] = {
            id: r.id,
            tipo: r.tipo,
            status: r.status,
            data_corte: r.data_corte,
          }
        }
      })
      return map
    } catch {
      return {}
    }
  },

  /**
   * Cria um novo processo de migração (Entrada ou Saída) inicializando o checklist padrão
   */
  async criarProcesso(
    input: CriarProcessoMigracaoInput,
    usuarioId: string,
    usuarioNome = 'Usuário',
  ): Promise<EmpresaMigracaoOnboardingRecord> {
    const itensBase =
      input.tipo === 'entrada' ? ITENS_PADRAO_MIGRACAO_ENTRADA : ITENS_PADRAO_MIGRACAO_SAIDA

    const checklistItens: ItemChecklistMigracao[] = itensBase.map((it, idx) => ({
      ...it,
      id: `item_${Date.now()}_${idx}`,
      concluido: false,
    }))

    const historicoInicial: HistoricoMigracaoAtividade[] = [
      {
        id: `act_${Date.now()}`,
        data: new Date().toISOString(),
        usuario_id: usuarioId,
        usuario_nome: usuarioNome,
        acao: `Início do processo de migração de ${input.tipo === 'entrada' ? 'ENTRADA (Onboarding)' : 'SAÍDA (Handover)'}`,
        detalhes: `Processo criado para a empresa. Data de corte pretendida: ${input.data_corte || 'A definir'}.`,
      },
    ]

    const record = await pb
      .collection('empresas_migracoes_onboarding')
      .create<EmpresaMigracaoOnboardingRecord>({
        tenant_id: input.tenant_id,
        empresa_id: input.empresa_id,
        tipo: input.tipo,
        status: 'iniciado',
        responsavel_id: input.responsavel_id || null,
        data_inicio: input.data_inicio || new Date().toISOString(),
        data_corte: input.data_corte || null,
        primeira_competencia: input.primeira_competencia || null,
        contador_anterior: input.contador_anterior || null,
        novo_contador: input.novo_contador || null,
        contato_outro_contador: input.contato_outro_contador || null,
        regime_tributario_definido: input.regime_tributario_definido || null,
        motivo_saida: input.motivo_saida || null,
        checklist_itens_json: checklistItens,
        historico_atividades_json: historicoInicial,
        observacoes: input.observacoes || null,
      })

    // Registrar no log oficial de auditoria
    await auditService.log(
      input.tenant_id,
      usuarioId,
      'CRIAR_MIGRACAO_ONBOARDING',
      'empresas_migracoes_onboarding',
      record.id,
      `Criado processo de migração de ${input.tipo.toUpperCase()} para a empresa ID ${input.empresa_id}.`,
    )

    return record
  },

  /**
   * Alterna ou atualiza um item de checklist com suporte a observação e vinculação de documento no GED
   */
  async atualizarItemChecklist(params: {
    processoId: string
    itemId: string
    concluido: boolean
    responsavelNome?: string
    responsavelId?: string
    observacao?: string
    documentoGedId?: string
    documentoGedNome?: string
    usuarioId: string
    usuarioNome?: string
  }): Promise<EmpresaMigracaoOnboardingRecord> {
    const proc = await this.getById(params.processoId)
    const itens = [...(proc.checklist_itens_json || [])]
    const idx = itens.findIndex((it) => it.id === params.itemId || it.codigo === params.itemId)

    if (idx === -1) {
      throw new Error(`Item ${params.itemId} não encontrado no checklist.`)
    }

    const itemAntigo = itens[idx]
    const itemAtualizado: ItemChecklistMigracao = {
      ...itemAntigo,
      concluido: params.concluido,
      concluido_em: params.concluido
        ? itemAntigo.concluido_em || new Date().toISOString()
        : undefined,
      responsavel_nome: params.responsavelNome || itemAntigo.responsavel_nome,
      responsavel_id: params.responsavelId || itemAntigo.responsavel_id,
      observacao: params.observacao !== undefined ? params.observacao : itemAntigo.observacao,
      documento_ged_id:
        params.documentoGedId !== undefined ? params.documentoGedId : itemAntigo.documentoGed_id,
      documento_ged_nome:
        params.documentoGedNome !== undefined
          ? params.documentoGedNome
          : itemAntigo.documento_ged_nome,
    }
    itens[idx] = itemAtualizado

    // Calcular novo status geral sugerido
    const totalItens = itens.length
    const concluidos = itens.filter((i) => i.concluido).length
    let novoStatus: MigracaoStatus = proc.status

    if (novoStatus !== 'cancelado' && novoStatus !== 'concluido') {
      if (concluidos === totalItens && totalItens > 0) {
        novoStatus = 'em_andamento' // pronto para conclusão formal
      } else if (concluidos > 0) {
        novoStatus = 'em_andamento'
      } else {
        novoStatus = 'iniciado'
      }
    }

    const novaAtividade: HistoricoMigracaoAtividade = {
      id: `act_${Date.now()}`,
      data: new Date().toISOString(),
      usuario_id: params.usuarioId,
      usuario_nome: params.usuarioNome || 'Usuário',
      acao: params.concluido
        ? `Item concluído: "${itemAntigo.titulo}"`
        : `Item desmarcado como pendente: "${itemAntigo.titulo}"`,
      detalhes: params.observacao ? `Obs: ${params.observacao}` : undefined,
    }

    const historico = [novaAtividade, ...(proc.historico_atividades_json || [])]

    const updated = await pb
      .collection('empresas_migracoes_onboarding')
      .update<EmpresaMigracaoOnboardingRecord>(proc.id, {
        checklist_itens_json: itens,
        status: novoStatus,
        historico_atividades_json: historico,
      })

    // Auditoria
    await auditService.log(
      proc.tenant_id,
      params.usuarioId,
      'ATUALIZAR_ITEM_MIGRACAO',
      'empresas_migracoes_onboarding',
      proc.id,
      `Item "${itemAntigo.codigo} - ${itemAntigo.titulo}" marcado como ${params.concluido ? 'CONCLUÍDO' : 'PENDENTE'}.`,
    )

    return updated
  },

  /**
   * Faz upload de arquivo para a coleção 'documentos' (GED) e vincula diretamente ao item do checklist
   */
  async uploadDocumentoItemChecklist(params: {
    processoId: string
    itemId: string
    empresaId: string
    tenantId: string
    arquivo: File
    usuarioId: string
    usuarioNome?: string
  }): Promise<{
    processo: EmpresaMigracaoOnboardingRecord
    documentoId: string
    documentoNome: string
  }> {
    const formData = new FormData()
    formData.append('tenant_id', params.tenantId)
    formData.append('empresa_id', params.empresaId)
    formData.append('nome_arquivo', params.arquivo.name)
    formData.append('tipo', 'procuracoes') // tipo aceito na coleção documentos
    formData.append('status', 'processado')
    formData.append('origem_documento', 'upload_manual')
    formData.append(
      'observacoes',
      `Documento anexado no processo de migração/onboarding (Processo ID: ${params.processoId}).`,
    )
    formData.append('arquivo', params.arquivo)
    if (params.usuarioId && params.usuarioId !== 'system') {
      formData.append('usuario_upload_id', params.usuarioId)
    }

    const docCriado = await documentosService.create(formData)

    // Atualiza o item do checklist com o link para o GED
    const procAtualizado = await this.atualizarItemChecklist({
      processoId: params.processoId,
      itemId: params.itemId,
      concluido: true,
      documentoGedId: docCriado.id,
      documentoGedNome: params.arquivo.name,
      usuarioId: params.usuarioId,
      usuarioNome: params.usuarioNome,
      observacao: `Arquivo arquivado no GED: ${params.arquivo.name}`,
    })

    return {
      processo: procAtualizado,
      documentoId: docCriado.id,
      documentoNome: params.arquivo.name,
    }
  },

  /**
   * Atualiza dados cadastrais/estratégicos do processo (Data de corte, regime, responsáveis, status)
   */
  async atualizarProcesso(
    id: string,
    dados: Partial<EmpresaMigracaoOnboardingRecord>,
    usuarioId: string,
    usuarioNome = 'Usuário',
    motivoMudanca?: string,
  ): Promise<EmpresaMigracaoOnboardingRecord> {
    const proc = await this.getById(id)

    const novaAtividade: HistoricoMigracaoAtividade = {
      id: `act_${Date.now()}`,
      data: new Date().toISOString(),
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      acao: 'Atualização das informações do processo',
      detalhes:
        motivoMudanca ||
        `Campos alterados: ${Object.keys(dados)
          .filter((k) => k !== 'historico_atividades_json')
          .join(', ')}`,
    }

    const historico = [novaAtividade, ...(proc.historico_atividades_json || [])]

    const updated = await pb
      .collection('empresas_migracoes_onboarding')
      .update<EmpresaMigracaoOnboardingRecord>(id, {
        ...dados,
        historico_atividades_json: historico,
      })

    await auditService.log(
      proc.tenant_id,
      usuarioId,
      'EDITAR_MIGRACAO_ONBOARDING',
      'empresas_migracoes_onboarding',
      id,
      `Processo de migração atualizado. ${motivoMudanca || ''}`,
    )

    return updated
  },

  /**
   * Conclui formalmente a migração e assunção/entrega da responsabilidade técnica
   */
  async concluirProcesso(
    id: string,
    usuarioId: string,
    usuarioNome = 'Usuário',
    observacoesFinais?: string,
  ): Promise<EmpresaMigracaoOnboardingRecord> {
    const proc = await this.getById(id)

    const novaAtividade: HistoricoMigracaoAtividade = {
      id: `act_${Date.now()}`,
      data: new Date().toISOString(),
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      acao:
        proc.tipo === 'entrada'
          ? 'Responsabilidade técnica assumida com sucesso (Onboarding concluído)'
          : 'Transferência e handover concluídos com sucesso (Saída finalizada)',
      detalhes: observacoesFinais || 'Processo concluído com todas as etapas homologadas.',
    }

    const historico = [novaAtividade, ...(proc.historico_atividades_json || [])]

    const updated = await pb
      .collection('empresas_migracoes_onboarding')
      .update<EmpresaMigracaoOnboardingRecord>(id, {
        status: 'concluido',
        concluido_em: new Date().toISOString(),
        concluido_por_id: usuarioId,
        historico_atividades_json: historico,
      })

    await auditService.log(
      proc.tenant_id,
      usuarioId,
      'CONCLUIR_MIGRACAO_ONBOARDING',
      'empresas_migracoes_onboarding',
      id,
      `Processo de ${proc.tipo.toUpperCase()} CONCLUÍDO. ${observacoesFinais || ''}`,
    )

    return updated
  },

  /**
   * Cancela o processo com registro de justificativa
   */
  async cancelarProcesso(
    id: string,
    justificativa: string,
    usuarioId: string,
    usuarioNome = 'Usuário',
  ): Promise<EmpresaMigracaoOnboardingRecord> {
    const proc = await this.getById(id)

    const novaAtividade: HistoricoMigracaoAtividade = {
      id: `act_${Date.now()}`,
      data: new Date().toISOString(),
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      acao: 'Processo de migração CANCELADO',
      detalhes: `Justificativa: ${justificativa}`,
    }

    const historico = [novaAtividade, ...(proc.historico_atividades_json || [])]

    const updated = await pb
      .collection('empresas_migracoes_onboarding')
      .update<EmpresaMigracaoOnboardingRecord>(id, {
        status: 'cancelado',
        historico_atividades_json: historico,
      })

    await auditService.log(
      proc.tenant_id,
      usuarioId,
      'CANCELAR_MIGRACAO_ONBOARDING',
      'empresas_migracoes_onboarding',
      id,
      `Processo de ${proc.tipo.toUpperCase()} CANCELADO. Justificativa: ${justificativa}`,
    )

    return updated
  },

  /**
   * Exclui um processo (apenas administradores, com auditoria)
   */
  async delete(id: string, tenantId: string, usuarioId: string): Promise<boolean> {
    await auditService.log(
      tenantId,
      usuarioId,
      'EXCLUIR_MIGRACAO_ONBOARDING',
      'empresas_migracoes_onboarding',
      id,
      `Registro de processo de migração removido permanentemente.`,
    )
    return pb.collection('empresas_migracoes_onboarding').delete(id)
  },
}
