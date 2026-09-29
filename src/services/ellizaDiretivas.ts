import pb from '@/lib/pocketbase/client'
import { auditService } from '@/services/audit'
import type {
  EllizaDiretivaRecord,
  EllizaAprovacaoRecord,
  EllizaAtividade,
  EllizaNivelAutonomia,
} from '@/types'

export const ATIVIDADES_ELLIZA_CONFIG: Record<
  EllizaAtividade,
  { label: string; descricao: string; modulo: string; restricaoSupervisao?: string }
> = {
  folha_dp: {
    label: 'Folha de Pagamento & DP',
    descricao: 'Conferência de cálculos CLT, apontamento de ponto, férias e rescisões.',
    modulo: 'Departamento Pessoal',
    restricaoSupervisao: 'Cálculos e auditoria liberados; fechamento oficial requer contador.',
  },
  fiscal_apuracao: {
    label: 'Apuração Fiscal & Impostos',
    descricao: 'Diagnóstico de notas fiscais, retenções de impostos e guias de recolhimento.',
    modulo: 'Fiscal',
    restricaoSupervisao: 'Leitura contínua; apuração e geração de guias supervisionadas.',
  },
  contabil_lancamentos: {
    label: 'Lançamentos Contábeis',
    descricao: 'Geração de pré-lançamentos a partir de extratos e documentos fiscais.',
    modulo: 'Contábil',
    restricaoSupervisao: 'Pré-lançamentos gerados; confirmação no razão contábil exige aprovação.',
  },
  obrigacoes_transmissao: {
    label: 'Transmissão de Obrigações Fiscais',
    descricao: 'Transmissão de DCTFWeb, EFD-Reinf, SPED, DEFIS e eSocial aos portais do governo.',
    modulo: 'Obrigações & Portais',
    restricaoSupervisao: 'Nunca autônomo. Transmissão com e-CNPJ sempre exige aprovação explícita.',
  },
  whatsapp_envio: {
    label: 'Disparo de Notificações WhatsApp',
    descricao: 'Avisos preventivos de vencimento, prévias e guias via Evolution API.',
    modulo: 'Comunicação Ativa',
    restricaoSupervisao: 'Dispara apenas para empresas com autorização ativa no portal.',
  },
  cobranca: {
    label: 'Cobrança Recorrente & Mensalidades',
    descricao: 'Geração mensal de faturas, PIX copia-e-cola e lembretes de inadimplência.',
    modulo: 'Financeiro / Cobrança',
    restricaoSupervisao:
      'Executa cobranças recorrentes no dia do faturamento e lembretes em D+3 e D+7.',
  },
  atendimento: {
    label: 'Atendimento & Dúvidas 24/7',
    descricao: 'Respostas a clientes e contadores no chat inteligente da ELLIZA.',
    modulo: 'Atendimento IA',
    restricaoSupervisao: 'Isolamento estrito multi-tenant de dados e histórico de conversas.',
  },
}

export const ellizaDiretivasService = {
  /**
   * Listar todas as diretivas configuradas para o tenant
   */
  async listDiretivas(tenantId: string): Promise<EllizaDiretivaRecord[]> {
    try {
      const records = await pb.collection('elliza_diretivas').getFullList<EllizaDiretivaRecord>({
        filter: `tenant_id = '${tenantId}'`,
        sort: 'atividade',
      })
      return records
    } catch (err) {
      console.error('[ellizaDiretivasService.listDiretivas] Erro:', err)
      return []
    }
  },

  /**
   * Atualizar uma diretiva operacional específica
   */
  async updateDiretiva(
    id: string,
    dados: {
      nivel_autonomia?: EllizaNivelAutonomia
      ativo?: boolean
      janela_inicio?: string
      janela_fim?: string
      limite_diario?: number
      observacoes?: string
    },
    tenantId: string,
  ): Promise<EllizaDiretivaRecord> {
    const atual = await pb.collection('elliza_diretivas').getOne<EllizaDiretivaRecord>(id)
    const updated = await pb.collection('elliza_diretivas').update<EllizaDiretivaRecord>(id, dados)

    const userId = pb.authStore.record?.id || 'system'
    await auditService.log(
      tenantId,
      userId,
      'ELLIZA_DIRETIVA_ATUALIZADA',
      'elliza_diretivas',
      id,
      JSON.stringify({
        atividade: atual.atividade,
        nivel_anterior: atual.nivel_autonomia,
        nivel_novo: dados.nivel_autonomia ?? atual.nivel_autonomia,
        ativo_anterior: atual.ativo,
        ativo_novo: dados.ativo ?? atual.ativo,
      }),
    )

    return updated
  },

  /**
   * Listar itens da fila de aprovação da ELLIZA
   */
  async listAprovacoes(
    tenantId: string,
    statusFiltro?: 'pendente' | 'aprovado' | 'rejeitado' | 'todos',
  ): Promise<EllizaAprovacaoRecord[]> {
    try {
      let filter = `tenant_id = '${tenantId}'`
      if (statusFiltro && statusFiltro !== 'todos') {
        filter += ` && status = '${statusFiltro}'`
      }
      return await pb.collection('elliza_aprovacoes').getFullList<EllizaAprovacaoRecord>({
        filter,
        sort: '-created',
        expand: 'aprovado_por',
      })
    } catch (err) {
      console.error('[ellizaDiretivasService.listAprovacoes] Erro:', err)
      return []
    }
  },

  /**
   * Decidir (aprovar ou rejeitar) um item da fila de aprovação
   */
  async decidirAprovacao(
    id: string,
    decisao: 'aprovado' | 'rejeitado',
    justificativa?: string,
  ): Promise<{ sucesso: boolean; mensagem: string }> {
    const token = pb.authStore.token
    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/elliza/aprovacoes/${id}/decidir`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decisao, justificativa }),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.erro || 'Falha ao processar decisão de aprovação')
    }

    return await res.json()
  },
}
