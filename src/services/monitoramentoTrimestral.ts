import pb from '@/lib/pocketbase/client'
import type { RankingTrimestralRecord, AlertaVariacaoRanking } from '@/types'
import {
  relatorioSetorialService,
  RelatorioSetorialCarteira,
  EmpresaImpactoSetorial,
} from './relatorioSetorial'

export interface ExecucaoManualResult {
  snapshotCriado: RankingTrimestralRecord
  alertasGerados: AlertaVariacaoRanking[]
  relatorioCarteira: RelatorioSetorialCarteira
  snapshotAnterior: RankingTrimestralRecord | null
}

export const monitoramentoTrimestralService = {
  /**
   * Lista o histórico de snapshots trimestrais de um tenant ordenados por data decrescente
   */
  async listarSnapshots(tenantId: string): Promise<RankingTrimestralRecord[]> {
    return await pb.collection('rankings_reforma_trimestral').getFullList<RankingTrimestralRecord>({
      filter: `tenant_id = "${tenantId}"`,
      sort: '-created',
      expand: 'executado_por',
    })
  },

  /**
   * Obtém o snapshot mais recente
   */
  async obterUltimoSnapshot(tenantId: string): Promise<RankingTrimestralRecord | null> {
    try {
      const records = await pb
        .collection('rankings_reforma_trimestral')
        .getList<RankingTrimestralRecord>(1, 1, {
          filter: `tenant_id = "${tenantId}"`,
          sort: '-created',
          expand: 'executado_por',
        })
      return records.items[0] || null
    } catch {
      return null
    }
  },

  /**
   * Executa a análise manual sob demanda:
   * 1. Gera o ranking setorial atualizado da carteira
   * 2. Compara com a última rodada do histórico (identificando |Δ| >= 10% ou |Δ| >= R$ 50.000)
   * 3. Registra notificações in-app para os administradores/contadores se houver oscilações relevantes
   * 4. Persiste o novo snapshot trimestral
   * 5. Registra log na auditoria
   */
  async executarAnaliseManual(tenantId: string, usuarioId?: string): Promise<ExecucaoManualResult> {
    const now = new Date()
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()
    const trimestre = Math.ceil(mes / 3)
    const periodoAtual = `${ano}-T${trimestre}`

    // 1. Obter snapshot anterior para comparativo
    const snapshotAnterior = await this.obterUltimoSnapshot(tenantId)

    // Mapa das empresas da rodada anterior por CNPJ
    const empresasAnterioresMap = new Map<string, Partial<EmpresaImpactoSetorial>>()
    if (snapshotAnterior && snapshotAnterior.resultado_json) {
      const rankingAnt =
        ((snapshotAnterior.resultado_json as any).rankingEmpresas as EmpresaImpactoSetorial[]) || []
      for (const item of rankingAnt) {
        if (item.cnpj) {
          empresasAnterioresMap.set(item.cnpj, item)
        }
      }
    }

    // 2. Recalcular o ranking setorial completo da carteira
    const relatorioAtual = await relatorioSetorialService.gerarRankingSetorialCarteira(tenantId)

    // 3. Comparar empresa a empresa e gerar alertas se |Δ| >= 10% ou |Δ| >= R$ 50.000
    const alertas: AlertaVariacaoRanking[] = []

    for (const emp of relatorioAtual.rankingEmpresas) {
      if (!emp.dadosSuficientes) continue

      const anterior = empresasAnterioresMap.get(emp.cnpj)
      if (anterior) {
        const impactoAnterior = anterior.impactoAcumuladoReais || 0
        const diffImpacto = emp.impactoAcumuladoReais - impactoAnterior
        let diffPercent = 0
        if (Math.abs(impactoAnterior) > 0) {
          diffPercent = (diffImpacto / Math.abs(impactoAnterior)) * 100
        }

        const ultrapassouLimiar = Math.abs(diffPercent) >= 10 || Math.abs(diffImpacto) >= 50000

        if (ultrapassouLimiar) {
          let causaProvavel = 'Atualização de parâmetros legais (EC 132/23 e LC 214/25)'
          if (anterior.faturamentoBase && anterior.faturamentoBase !== emp.faturamentoBase) {
            causaProvavel = `Alteração no faturamento base anual (${emp.origemDescricao})`
          } else if (anterior.regime && anterior.regime !== emp.regime) {
            causaProvavel = 'Mudança no enquadramento de regime tributário'
          }

          alertas.push({
            cnpj: emp.cnpj,
            razaoSocial: emp.razaoSocial,
            nomeFantasia: emp.nomeFantasia,
            impactoAnteriorReais: impactoAnterior,
            impactoNovoReais: emp.impactoAcumuladoReais,
            diferencaReais: Math.round(diffImpacto * 100) / 100,
            diferencaPercentual: Math.round(diffPercent * 10) / 10,
            tipoVariacao: diffImpacto > 0 ? 'aumento' : 'reducao',
            causaProvavel,
          })
        }
      }
    }

    // 4. Salvar novo snapshot na coleção rankings_reforma_trimestral
    const novoSnapshot = await pb
      .collection('rankings_reforma_trimestral')
      .create<RankingTrimestralRecord>({
        tenant_id: tenantId,
        periodo: periodoAtual,
        ano,
        trimestre,
        data_execucao: now.toISOString(),
        executado_por_tipo: 'manual_usuario',
        executado_por: usuarioId || null,
        total_empresas: relatorioAtual.totalEmpresasAnalisadas,
        total_suficientes: relatorioAtual.totalEmpresasSuficientes,
        faturamento_total: relatorioAtual.faturamentoTotalCarteira,
        impacto_total_acumulado: relatorioAtual.impactoTotalCarteiraAcumuladoReais,
        variacao_media_percentual: relatorioAtual.variacaoGeralCarteiraPercentual,
        resultado_json: {
          rankingEmpresas: relatorioAtual.rankingEmpresas,
          totalEmpresasAnalisadas: relatorioAtual.totalEmpresasAnalisadas,
          totalEmpresasSuficientes: relatorioAtual.totalEmpresasSuficientes,
          totalEmpresasInsuficientes: relatorioAtual.totalEmpresasInsuficientes,
          impactoTotalCarteiraAcumuladoReais: relatorioAtual.impactoTotalCarteiraAcumuladoReais,
          faturamentoTotalCarteira: relatorioAtual.faturamentoTotalCarteira,
          cargaAtualTotalCarteira: relatorioAtual.cargaAtualTotalCarteira,
          carga2033TotalCarteira: relatorioAtual.carga2033TotalCarteira,
          variacaoGeralCarteiraPercentual: relatorioAtual.variacaoGeralCarteiraPercentual,
          setoresResumo: relatorioAtual.setoresResumo,
        },
        alertas_variacao_json: alertas,
        versao_normativa: 'EC 132/2023 e LC 214/2025',
      })

    // 5. Se houver alertas de variação relevante, disparar notificações in-app aos gestores
    if (alertas.length > 0) {
      try {
        const staffMembers = await pb.collection('tenant_members').getFullList({
          filter: `tenant_id = "${tenantId}" && (perfil = "administrador" || perfil = "contador")`,
        })

        for (const alerta of alertas) {
          const tituloNotif =
            alerta.diferencaReais > 0
              ? `Reforma Tributária: Alerta de Aumento (${alerta.nomeFantasia || alerta.razaoSocial})`
              : `Reforma Tributária: Redução Relevante (${alerta.nomeFantasia || alerta.razaoSocial})`

          const msgNotif = `Na rodada ${periodoAtual}, o impacto acumulado estimado para a empresa ${alerta.razaoSocial} variou ${alerta.diferencaPercentual > 0 ? '+' : ''}${alerta.diferencaPercentual}% (Δ R$ ${Math.abs(alerta.diferencaReais).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Causa: ${alerta.causaProvavel}.`

          for (const member of staffMembers) {
            if (member.user_id) {
              await pb.collection('notificacoes').create({
                tenant_id: tenantId,
                usuario_destino_id: member.user_id,
                titulo: tituloNotif,
                mensagem: msgNotif,
                tipo: 'sistema',
                link: '/simulador-reforma',
                lida: false,
              })
            }
          }
        }
      } catch (errNotif) {
        console.warn('Erro ao registrar notificações dos alertas:', errNotif)
      }
    }

    // 6. Trilha de auditoria
    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: usuarioId || null,
        acao: 'recalculo_manual_ranking_reforma',
        entidade_tipo: 'rankings_reforma_trimestral',
        entidade_id: novoSnapshot.id,
        detalhes: JSON.stringify({
          periodo: periodoAtual,
          totalEmpresas: relatorioAtual.totalEmpresasAnalisadas,
          impactoTotal: relatorioAtual.impactoTotalCarteiraAcumuladoReais,
          alertasGerados: alertas.length,
        }),
      })
    } catch {
      /* intentionally ignored */
    }

    return {
      snapshotCriado: novoSnapshot,
      alertasGerados: alertas,
      relatorioCarteira: relatorioAtual,
      snapshotAnterior,
    }
  },
}
