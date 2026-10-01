import pb from '@/lib/pocketbase/client'

export type IntegraContadorAmbiente = 'trial' | 'producao'
export type IntegraContadorStatusConexao =
  | 'conectado'
  | 'erro_credenciais'
  | 'modo_supervisao'
  | 'desconectado'

export interface IntegraContadorConfig {
  id: string
  tenant_id: string
  ativo: boolean
  ambiente: IntegraContadorAmbiente
  consumer_key: string
  consumer_secret: string
  contratante_cnpj: string
  autor_pedido_dados_numero?: string
  certificado_a1?: string
  senha_certificado?: string
  proxy_mtls_url?: string
  sincronizacao_automatica: boolean
  sincronizar_situacao_fiscal: boolean
  sincronizar_caixa_postal: boolean
  sincronizar_dctfweb: boolean
  sincronizar_pgdas: boolean
  status_conexao: IntegraContadorStatusConexao
  ultimo_diagnostico_json?: any
  ultima_sincronizacao_em?: string
  created?: string
  updated?: string
}

export interface DiagnosticoItem {
  item: string
  status: 'ok' | 'alerta' | 'erro'
  detalhe: string
}

export interface TestarConexaoResult {
  sucesso: boolean
  credenciado: boolean
  modo_supervisao: boolean
  status_conexao: IntegraContadorStatusConexao
  diagnostico_tipo:
    | 'credenciado'
    | 'credenciais_invalidas'
    | 'credenciais_ausentes'
    | 'proxy_mtls_ausente'
    | 'url_inalcancavel'
  ambiente: IntegraContadorAmbiente
  duracao_ms: number
  mensagem: string
  itens: DiagnosticoItem[]
  verificado_em: string
}

export interface ResumoConsumoResult {
  mes_referencia: string
  total_chamadas: number
  total_custo_estimado: number
  chamadas_oficiais: number
  chamadas_supervisao: number
  servicos: {
    SITFIS: { qtd: number; custo: number; sucessos: number; erros: number }
    CAIXAPOSTAL: { qtd: number; custo: number; sucessos: number; erros: number }
    DCTFWEB: { qtd: number; custo: number; sucessos: number; erros: number }
    PGDASD: { qtd: number; custo: number; sucessos: number; erros: number }
    PNRCONTADOR?: { qtd: number; custo: number; sucessos: number; erros: number }
    TESTE_CONEXAO?: { qtd: number; custo: number; sucessos: number; erros: number }
    OUTRO?: { qtd: number; custo: number; sucessos: number; erros: number }
    [key: string]: { qtd: number; custo: number; sucessos: number; erros: number } | undefined
  }
}

export interface SincronizarLoteDetalheEmpresa {
  empresa_id: string
  razao_social: string
  cnpj: string
  status: 'sucesso' | 'modo_supervisao' | 'erro_autorizacao' | 'pendente'
  motivo?: string
}

export interface SincronizarLoteResult {
  tenant_id: string
  origem: string
  data_inicio: string
  empresas_analisadas: number
  empresas_sincronizadas: number
  empresas_com_erro_autorizacao: number
  comunicacoes_novas: number
  certidoes_atualizadas: number
  duracao_total_ms: number
  detalhes: SincronizarLoteDetalheEmpresa[]
}

export interface SalvarConfigInput {
  tenant_id: string
  ativo: boolean
  ambiente: IntegraContadorAmbiente
  consumer_key: string
  consumer_secret: string
  contratante_cnpj: string
  autor_pedido_dados_numero?: string
  certificado_a1?: string
  senha_certificado?: string
  proxy_mtls_url?: string
  sincronizacao_automatica: boolean
  sincronizar_situacao_fiscal: boolean
  sincronizar_caixa_postal: boolean
  sincronizar_dctfweb: boolean
  sincronizar_pgdas: boolean
}

export const integraContadorService = {
  /**
   * Obtém a configuração do tenant no PocketBase
   */
  async getConfig(tenantId: string): Promise<IntegraContadorConfig | null> {
    try {
      const records = await pb
        .collection('integra_contador_config')
        .getFullList<IntegraContadorConfig>({
          filter: `tenant_id = "${tenantId}"`,
        })
      return records[0] || null
    } catch (err) {
      console.error('[integraContadorService] Erro ao carregar config:', err)
      return null
    }
  },

  /**
   * Salva ou atualiza a configuração do tenant
   */
  async saveConfig(input: SalvarConfigInput): Promise<IntegraContadorConfig> {
    const existing = await this.getConfig(input.tenant_id)
    const payload: Partial<IntegraContadorConfig> = {
      tenant_id: input.tenant_id,
      ativo: input.ativo,
      ambiente: input.ambiente,
      consumer_key: input.consumer_key,
      consumer_secret: input.consumer_secret,
      contratante_cnpj: input.contratante_cnpj,
      autor_pedido_dados_numero: input.autor_pedido_dados_numero || input.contratante_cnpj,
      certificado_a1: input.certificado_a1 || undefined,
      senha_certificado: input.senha_certificado || '',
      proxy_mtls_url: input.proxy_mtls_url || '',
      sincronizacao_automatica: input.sincronizacao_automatica,
      sincronizar_situacao_fiscal: input.sincronizar_situacao_fiscal,
      sincronizar_caixa_postal: input.sincronizar_caixa_postal,
      sincronizar_dctfweb: input.sincronizar_dctfweb,
      sincronizar_pgdas: input.sincronizar_pgdas,
    }

    if (existing) {
      return await pb
        .collection('integra_contador_config')
        .update<IntegraContadorConfig>(existing.id, payload)
    } else {
      return await pb.collection('integra_contador_config').create<IntegraContadorConfig>(payload)
    }
  },

  /**
   * Executa o teste de conexão oficial chamando o endpoint do SERPRO
   */
  async testarConexao(params: {
    tenant_id: string
    consumer_key?: string
    consumer_secret?: string
    ambiente?: IntegraContadorAmbiente
    contratante_cnpj?: string
    autor_pedido_dados_numero?: string
    proxy_mtls_url?: string
    certificado_a1?: string
  }): Promise<TestarConexaoResult> {
    return await pb.send<TestarConexaoResult>('/backend/v1/integra-contador/testar-conexao', {
      method: 'POST',
      body: params,
    })
  },

  /**
   * Obtém o resumo consolidado de consumo da competência
   */
  async getResumoConsumo(tenantId: string): Promise<ResumoConsumoResult> {
    return await pb.send<ResumoConsumoResult>(
      `/backend/v1/integra-contador/resumo-consumo?tenant_id=${tenantId}`,
      {
        method: 'GET',
      },
    )
  },

  /**
   * Dispara a sincronização em lote de todas as empresas com autorização e-CAC ativa
   */
  async sincronizarLote(tenantId: string): Promise<SincronizarLoteResult> {
    return await pb.send<SincronizarLoteResult>('/backend/v1/integra-contador/sincronizar-lote', {
      method: 'POST',
      body: { tenant_id: tenantId },
    })
  },

  /**
   * Atualiza o status de autorização e-CAC de uma empresa
   */
  async atualizarAutorizacaoEmpresa(
    empresaId: string,
    status: 'ativa' | 'em_analise' | 'vencida' | 'nao_solicitada',
    observacao?: string,
  ): Promise<void> {
    await pb.collection('empresas').update(empresaId, {
      autorizacao_acesso_ecac: status,
      autorizacao_acesso_atualizada_em: new Date().toISOString(),
      ...(observacao ? { autorizacao_acesso_observacao: observacao } : {}),
    })
  },
}
