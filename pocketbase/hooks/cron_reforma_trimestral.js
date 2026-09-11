// Hook: cron_reforma_trimestral.js
// Trimestral scheduled job (executa no primeiro dia dos meses 1, 4, 7 e 10 às 03:00 UTC)
// Recalcula o ranking setorial da reforma tributária (EC 132/23 e LC 214/25) para cada tenant,
// armazena o snapshot na coleção rankings_reforma_trimestral,
// compara com a rodada anterior de cada empresa e gera notificações in-app e e-mails aos
// Contadores e Administradores caso haja variação relevante (|Δ| >= 10% ou |Δ| >= R$ 50.000).

cronAdd('quarterly_reforma_ranking', '0 3 1 1,4,7,10 *', () => {
  try {
    console.log('[CRON] Executing quarterly_reforma_ranking...')
    const now = new Date()
    const nowISO = now.toISOString()
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()
    const trimestre = Math.ceil(mes / 3)
    const periodoAtual = ano + '-T' + trimestre

    const activeTenants = $app.findRecordsByFilter('tenants', 'ativo = true', '', 100, 0)
    console.log('[CRON] Found', activeTenants.length, 'active tenants for reforma ranking snapshot')

    const rankingsCol = $app.findCollectionByNameOrId('rankings_reforma_trimestral')
    const notificacoesCol = $app.findCollectionByNameOrId('notificacoes')

    // Helper inside callback: send transactional email gracefully
    const sendEmailGraceful = (toEmail, subject, htmlBody) => {
      if (!toEmail) return
      try {
        const mailClient = $app.newMailClient()
        mailClient.send({
          from: {
            address: 'notificacoes@rumoconsultoriacontabil.com.br',
            name: 'Rumo Consultoria Contábil',
          },
          to: [{ address: toEmail }],
          subject: subject,
          html: htmlBody,
        })
      } catch (err) {
        console.log('[CRON] Graceful email fallback for', toEmail, ':', err)
      }
    }

    for (let t = 0; t < activeTenants.length; t++) {
      const tenantRec = activeTenants[t]
      const tenantId = tenantRec.id
      const tenantNome = tenantRec.getString('nome') || 'Escritório Contábil'

      try {
        // Buscar último snapshot para comparação
        let snapshotAnterior = null
        try {
          const ultimosSnapshots = $app.findRecordsByFilter(
            'rankings_reforma_trimestral',
            "tenant_id = '" + tenantId + "'",
            '-created',
            1,
            0,
          )
          if (ultimosSnapshots.length > 0) {
            snapshotAnterior = ultimosSnapshots[0]
          }
        } catch (_) {}

        // Empresas ativas do tenant
        const empresas = $app.findRecordsByFilter(
          'empresas',
          "tenant_id = '" + tenantId + "' && status = 'ativo'",
          'razao_social ASC',
          500,
          0,
        )

        // Buscar simulações salvas existentes para carregar parâmetros refinados
        const simSalvas = $app.findRecordsByFilter(
          'simulacoes_reforma',
          "tenant_id = '" + tenantId + "'",
          '-created',
          200,
          0,
        )
        const simMap = {}
        for (let s = 0; s < simSalvas.length; s++) {
          const empRef = simSalvas[s].getString('empresa')
          if (empRef && !simMap[empRef]) {
            simMap[empRef] = simSalvas[s]
          }
        }

        // Mapa do snapshot anterior por CNPJ
        const empresasAnteriorMap = {}
        if (snapshotAnterior) {
          const resJson = snapshotAnterior.get('resultado_json') || {}
          const rankingAnt = resJson.rankingEmpresas || []
          for (let a = 0; a < rankingAnt.length; a++) {
            const itemAnt = rankingAnt[a]
            if (itemAnt.cnpj) {
              empresasAnteriorMap[itemAnt.cnpj] = itemAnt
            }
          }
        }

        const empresasProcessadas = []
        const alertasVariacao = []
        let faturamentoTotal = 0
        let cargaAtualTotal = 0
        let carga2033Total = 0
        let impactoTotalAcumulado = 0

        for (let e = 0; e < empresas.length; e++) {
          const emp = empresas[e]
          const empId = emp.id
          const razaoSocial = emp.getString('razao_social')
          const nomeFantasia = emp.getString('nome_fantasia')
          const cnpj = emp.getString('cnpj')
          const regimeCadastrado = emp.getString('regime_tributario')
          const porte = emp.getString('porte')
          const obs = (emp.getString('observacoes') || '').toLowerCase()
          const sim = simMap[empId]

          // 1. Detectar setor e tratamento favorecido 60%
          let setor = 'servicos_geral'
          let setorNome = 'Serviços em Geral / Consultoria / BPO'
          let reducao60 = false
          let aliqPresumidoPadrao = 14.53
          let percentualCreditos = 15

          const textoDetect = (razaoSocial + ' ' + nomeFantasia + ' ' + obs).toLowerCase()

          if (sim && sim.getString('setor_atividade')) {
            setor = sim.getString('setor_atividade')
            reducao60 = sim.getBool('reducao_setorial_60')
          } else if (
            textoDetect.includes('saúde') ||
            textoDetect.includes('saude') ||
            textoDetect.includes('médic') ||
            textoDetect.includes('medic') ||
            textoDetect.includes('clínica') ||
            textoDetect.includes('clinica') ||
            textoDetect.includes('hospital')
          ) {
            setor = 'servicos_saude'
            setorNome = 'Serviços de Saúde Humana (Clínicas, Hospitais, Laboratórios)'
            reducao60 = true
            aliqPresumidoPadrao = 11.5
            percentualCreditos = 25
          } else if (
            textoDetect.includes('educa') ||
            textoDetect.includes('escola') ||
            textoDetect.includes('faculdade') ||
            textoDetect.includes('ensino')
          ) {
            setor = 'servicos_educacao'
            setorNome = 'Serviços Educacionais (Escolas, Faculdades)'
            reducao60 = true
            aliqPresumidoPadrao = 12.0
            percentualCreditos = 20
          } else if (
            textoDetect.includes('transporte') ||
            textoDetect.includes('passageiros') ||
            textoDetect.includes('ônibus') ||
            textoDetect.includes('onibus')
          ) {
            setor = 'transporte_coletivo'
            setorNome = 'Transporte Coletivo de Passageiros'
            reducao60 = true
            aliqPresumidoPadrao = 9.0
            percentualCreditos = 40
          } else if (
            textoDetect.includes('software') ||
            textoDetect.includes('tecnologia') ||
            textoDetect.includes('sistemas') ||
            textoDetect.includes('saas') ||
            textoDetect.includes('ti')
          ) {
            setor = 'tecnologia_software'
            setorNome = 'Tecnologia da Informação & Licenciamento de Software'
            reducao60 = false
            aliqPresumidoPadrao = 14.53
            percentualCreditos = 18
          } else if (
            textoDetect.includes('comércio') ||
            textoDetect.includes('comercio') ||
            textoDetect.includes('varej') ||
            textoDetect.includes('cafeteria') ||
            textoDetect.includes('grãos') ||
            textoDetect.includes('loja')
          ) {
            setor = 'comercio_geral'
            setorNome = 'Comércio Varejista e Atacadista Geral'
            reducao60 = false
            aliqPresumidoPadrao = 16.0
            percentualCreditos = 65
          }

          // Regime
          let regime = regimeCadastrado || 'simples_nacional'
          if (sim && sim.getString('regime_atual')) {
            regime = sim.getString('regime_atual')
          }

          // Faturamento base
          let faturamentoBase = 0
          let origemFaturamento = 'insuficiente'
          let origemDescricao = 'Sem faturamento identificado'

          if (sim && sim.getFloat('faturamento_anual') > 0) {
            faturamentoBase = sim.getFloat('faturamento_anual')
            origemFaturamento = 'simulacao_salva'
            origemDescricao = 'Cenário Salvo'
          } else if (porte === 'mei') {
            faturamentoBase = 60000
            origemFaturamento = 'porte_declarado'
            origemDescricao = 'Estimado por porte (MEI)'
          } else if (porte === 'me') {
            faturamentoBase = 600000
            origemFaturamento = 'porte_declarado'
            origemDescricao = 'Estimado por porte (ME)'
          } else if (porte === 'epp') {
            faturamentoBase = 2400000
            origemFaturamento = 'porte_declarado'
            origemDescricao = 'Estimado por porte (EPP)'
          } else if (porte === 'demais') {
            faturamentoBase = 6000000
            origemFaturamento = 'porte_declarado'
            origemDescricao = 'Estimado por porte (Demais)'
          }

          const dadosSuficientes = faturamentoBase > 0

          // Alíquota atual
          let aliqAtual = 12.0
          if (sim && sim.getFloat('aliquota_atual_estimada') > 0) {
            aliqAtual = sim.getFloat('aliquota_atual_estimada')
          } else if (regime === 'simples_nacional') {
            if (faturamentoBase <= 180000) aliqAtual = 4.0
            else if (faturamentoBase <= 360000) aliqAtual = 6.5
            else if (faturamentoBase <= 720000) aliqAtual = 9.5
            else if (faturamentoBase <= 1800000) aliqAtual = 12.0
            else if (faturamentoBase <= 3600000) aliqAtual = 14.5
            else aliqAtual = 17.5
          } else if (regime === 'lucro_presumido') {
            aliqAtual = aliqPresumidoPadrao
          } else {
            aliqAtual = aliqPresumidoPadrao + 2.5
          }

          if (sim && sim.getFloat('percentual_creditos') > 0) {
            percentualCreditos = sim.getFloat('percentual_creditos')
          }

          let cargaAtualReais = 0
          let carga2033Reais = 0
          let impacto2033Reais = 0
          let variacao2033Percentual = 0
          let impactoAcumuladoReais = 0

          if (dadosSuficientes) {
            cargaAtualReais = (faturamentoBase * aliqAtual) / 100

            // Cálculo determinístico simplificado consistente com calculos.ts
            // 2033 pleno: CBS 8.8% + IBS 17.7% = 26.5%
            let fatorReducao = 1.0
            if (reducao60) fatorReducao = 0.4

            if (regime === 'simples_nacional' && faturamentoBase <= 3600000) {
              // Simples transição: aumento de ~25% no horizonte 2033
              carga2033Reais = cargaAtualReais * 1.25
              impacto2033Reais = carga2033Reais - cargaAtualReais
              variacao2033Percentual = 25.0
              // Acumulado 2026 a 2033 (8 anos com ramp-up médio de 5% ao ano = ~0.77x carga anual)
              impactoAcumuladoReais = cargaAtualReais * 0.77
            } else {
              const aliqCombinadaNominal = 26.5 * fatorReducao
              const debitoBruto = (faturamentoBase * aliqCombinadaNominal) / 100
              const creditos =
                (faturamentoBase * (percentualCreditos / 100) * aliqCombinadaNominal) / 100
              const ibsCbsLiquido = Math.max(0, debitoBruto - creditos)
              const irpjCsll = cargaAtualReais * 0.35
              carga2033Reais = ibsCbsLiquido + irpjCsll
              impacto2033Reais = carga2033Reais - cargaAtualReais
              variacao2033Percentual =
                cargaAtualReais > 0
                  ? ((carga2033Reais - cargaAtualReais) / cargaAtualReais) * 100
                  : 0
              // Acumulado ponderado ao longo dos anos
              impactoAcumuladoReais = impacto2033Reais * 4.2
            }

            faturamentoTotal += faturamentoBase
            cargaAtualTotal += cargaAtualReais
            carga2033Total += carga2033Reais
            impactoTotalAcumulado += impactoAcumuladoReais
          }

          const itemProcessado = {
            empresaId: empId,
            razaoSocial: razaoSocial,
            nomeFantasia: nomeFantasia,
            cnpj: cnpj,
            regime: regime,
            porte: porte,
            setor: setor,
            setorNome: setorNome,
            faturamentoBase: Math.round(faturamentoBase * 100) / 100,
            origemFaturamento: origemFaturamento,
            origemDescricao: origemDescricao,
            dadosSuficientes: dadosSuficientes,
            tratamentoFavorecido: reducao60,
            tratamentoBadge: reducao60
              ? 'Redução 60% (LC 214/25)'
              : regime === 'simples_nacional'
                ? 'Simples 50%'
                : 'Regime Geral',
            percentualCreditos: percentualCreditos,
            cargaAtualReais: Math.round(cargaAtualReais * 100) / 100,
            aliquotaAtualEfetiva: Math.round(aliqAtual * 10) / 10,
            carga2033Reais: Math.round(carga2033Reais * 100) / 100,
            aliquota2033Efetiva:
              faturamentoBase > 0 ? Math.round((carga2033Reais / faturamentoBase) * 1000) / 10 : 0,
            impacto2033Reais: Math.round(impacto2033Reais * 100) / 100,
            variacao2033Percentual: Math.round(variacao2033Percentual * 10) / 10,
            impactoAcumuladoReais: Math.round(impactoAcumuladoReais * 100) / 100,
          }

          empresasProcessadas.push(itemProcessado)

          // 2. Comparativo vs. Rodada Anterior
          if (dadosSuficientes && snapshotAnterior && empresasAnteriorMap[cnpj]) {
            const anterior = empresasAnteriorMap[cnpj]
            const impactoAnterior = anterior.impactoAcumuladoReais || 0
            const diffImpacto = itemProcessado.impactoAcumuladoReais - impactoAnterior
            let diffPercent = 0
            if (Math.abs(impactoAnterior) > 0) {
              diffPercent = (diffImpacto / Math.abs(impactoAnterior)) * 100
            }

            // Limiar de relevância: variação de impacto acumulado >= 10% OU >= R$ 50.000
            const ultrapassouLimiar = Math.abs(diffPercent) >= 10 || Math.abs(diffImpacto) >= 50000

            if (ultrapassouLimiar) {
              let causaProvavel = 'Atualização de parâmetros legais ou projeções setoriais'
              if (itemProcessado.faturamentoBase !== (anterior.faturamentoBase || 0)) {
                causaProvavel =
                  'Variação no faturamento base anual (lançamentos contábeis / regime)'
              } else if (itemProcessado.regime !== anterior.regime) {
                causaProvavel = 'Alteração do regime tributário cadastrado'
              }

              const alerta = {
                cnpj: cnpj,
                razaoSocial: razaoSocial,
                nomeFantasia: nomeFantasia,
                impactoAnteriorReais: impactoAnterior,
                impactoNovoReais: itemProcessado.impactoAcumuladoReais,
                diferencaReais: Math.round(diffImpacto * 100) / 100,
                diferencaPercentual: Math.round(diffPercent * 10) / 10,
                tipoVariacao: diffImpacto > 0 ? 'aumento' : 'reducao',
                causaProvavel: causaProvavel,
              }
              alertasVariacao.push(alerta)

              // Criar Notificação In-App e e-mail para Administradores e Contadores
              const tituloNotif =
                diffImpacto > 0
                  ? 'Reforma Tributária: Alerta de Aumento Relevante - ' +
                    (nomeFantasia || razaoSocial)
                  : 'Reforma Tributária: Redução Projetada Relevante - ' +
                    (nomeFantasia || razaoSocial)

              const msgNotif =
                'Na rodada trimestral (' +
                periodoAtual +
                '), o impacto acumulado estimado para a empresa ' +
                razaoSocial +
                ' variou ' +
                (diffPercent > 0 ? '+' : '') +
                diffPercent.toFixed(1) +
                '% (Δ R$ ' +
                Math.abs(diffImpacto).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) +
                '). Causa provável: ' +
                causaProvavel +
                '.'

              // Buscar membros equipe do tenant
              const staffMembers = $app.findRecordsByFilter(
                'tenant_members',
                "tenant_id = '" +
                  tenantId +
                  "' && (perfil = 'administrador' || perfil = 'contador')",
                '',
                10,
                0,
              )

              for (let m = 0; m < staffMembers.length; m++) {
                const staffUserId = staffMembers[m].getString('user_id')
                const notifRec = new Record(notificacoesCol)
                notifRec.set('tenant_id', tenantId)
                notifRec.set('usuario_destino_id', staffUserId)
                notifRec.set('titulo', tituloNotif)
                notifRec.set('mensagem', msgNotif)
                notifRec.set('tipo', 'sistema')
                notifRec.set('link', '/simulador-reforma')
                notifRec.set('lida', false)
                $app.save(notifRec)

                try {
                  const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                  if (staffUser && staffUser.getBool('email_notificacoes_prazo')) {
                    sendEmailGraceful(
                      staffUser.getString('email'),
                      '[Rumo - Reforma Tributária] ' + tituloNotif,
                      '<div style="font-family:sans-serif;color:#1A2333;max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;border-radius:12px;">' +
                        '<h2 style="color:#0B1F3A;margin-top:0;">Rumo Consultoria Contábil</h2>' +
                        '<p>Olá <b>' +
                        staffUser.getString('name') +
                        '</b>,</p>' +
                        '<p>O monitoramento trimestral do <b>Ranking Setorial da Reforma Tributária (' +
                        periodoAtual +
                        ')</b> identificou uma oscilação relevante de carga projetada:</p>' +
                        '<div style="background:#F8FAFC;padding:14px;border-radius:8px;border-left:4px solid ' +
                        (diffImpacto > 0 ? '#F59E0B' : '#10B981') +
                        ';margin:16px 0;">' +
                        '<p style="margin:0 0 6px 0;font-weight:bold;font-size:14px;color:#1A2333;">' +
                        razaoSocial +
                        ' (' +
                        cnpj +
                        ')</p>' +
                        '<p style="margin:0;font-size:13px;color:#475569;">' +
                        '<b>Variação Acumulada:</b> ' +
                        (diffPercent > 0 ? '+' : '') +
                        diffPercent.toFixed(1) +
                        '% (' +
                        (diffImpacto > 0 ? '+' : '') +
                        'R$ ' +
                        diffImpacto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
                        ')<br/>' +
                        '<b>Causa Provável:</b> ' +
                        causaProvavel +
                        '<br/>' +
                        '<b>Impacto Anterior:</b> R$ ' +
                        impactoAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
                        ' &rarr; <b>Novo Impacto:</b> R$ ' +
                        itemProcessado.impactoAcumuladoReais.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        }) +
                        '</p>' +
                        '</div>' +
                        '<p style="font-size:13px;color:#64748B;">Acesse a aba Ranking Setorial no Simulador da Reforma Tributária para verificar a apresentação executiva e apoiar o cliente.</p>' +
                        '</div>',
                    )
                  }
                } catch (_) {}
              }
            }
          }
        }

        // Ordenar empresas suficientes do maior impacto para o menor
        empresasProcessadas.sort((a, b) => {
          if (!a.dadosSuficientes && b.dadosSuficientes) return 1
          if (a.dadosSuficientes && !b.dadosSuficientes) return -1
          return b.impactoAcumuladoReais - a.impactoAcumuladoReais
        })

        const variacaoGeralCarteira =
          cargaAtualTotal > 0 ? ((carga2033Total - cargaAtualTotal) / cargaAtualTotal) * 100 : 0

        // Persistir novo snapshot trimestral
        const novoSnapshot = new Record(rankingsCol)
        novoSnapshot.set('tenant_id', tenantId)
        novoSnapshot.set('periodo', periodoAtual)
        novoSnapshot.set('ano', ano)
        novoSnapshot.set('trimestre', trimestre)
        novoSnapshot.set('data_execucao', nowISO)
        novoSnapshot.set('executado_por_tipo', 'cron_trimestral')
        novoSnapshot.set('total_empresas', empresas.length)
        novoSnapshot.set(
          'total_suficientes',
          empresasProcessadas.filter((e) => e.dadosSuficientes).length,
        )
        novoSnapshot.set('faturamento_total', Math.round(faturamentoTotal * 100) / 100)
        novoSnapshot.set('impacto_total_acumulado', Math.round(impactoTotalAcumulado * 100) / 100)
        novoSnapshot.set('variacao_media_percentual', Math.round(variacaoGeralCarteira * 10) / 10)
        novoSnapshot.set('versao_normativa', 'EC 132/2023 e LC 214/2025')
        novoSnapshot.set('resultado_json', {
          rankingEmpresas: empresasProcessadas,
          totalEmpresasAnalisadas: empresas.length,
          totalEmpresasSuficientes: empresasProcessadas.filter((e) => e.dadosSuficientes).length,
          impactoTotalCarteiraAcumuladoReais: Math.round(impactoTotalAcumulado * 100) / 100,
          faturamentoTotalCarteira: Math.round(faturamentoTotal * 100) / 100,
          cargaAtualTotalCarteira: Math.round(cargaAtualTotal * 100) / 100,
          carga2033TotalCarteira: Math.round(carga2033Total * 100) / 100,
        })
        novoSnapshot.set('alertas_variacao_json', alertasVariacao)
        $app.save(novoSnapshot)

        console.log(
          '[CRON] Snapshot trimestral salvo para tenant',
          tenantId,
          'Periodo:',
          periodoAtual,
          'Alertas gerados:',
          alertasVariacao.length,
        )
      } catch (errTenant) {
        console.log(
          '[CRON] Erro ao processar ranking trimestral para tenant ' + tenantId + ':',
          errTenant,
        )
      }
    }

    console.log('[CRON] Finished quarterly_reforma_ranking successfully.')
  } catch (err) {
    console.log('[CRON] Erro fatal no job quarterly_reforma_ranking:', err)
  }
})
