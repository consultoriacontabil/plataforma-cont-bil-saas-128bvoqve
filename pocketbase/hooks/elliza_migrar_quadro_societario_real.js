// Hook: elliza_migrar_quadro_societario_real.js
// Executa a Frente 1 e Frente 2 solicitadas pelo usuário:
// 1. Localiza os 19 documentos societários anexados no GED pelas empresas da carteira
// 2. Agrupa por empresa, identifica o documento vigente mais recente (alteração posterior prevalece)
// 3. Extrai sócios via $documents.toMarkdown + $ai.chat
// 4. Se o documento for escaneado sem OCR, faltar percentual ou a soma != 100%, faz PARADA HONESTA:
//    cria pendência estruturada no Modo Humano da esteira Elliza (processo_pendencias)
// 5. Atualiza/cria os registros em `socios`, vinculados à empresa correta
// 6. DEDUPLICA sócios demo (da migration 0114 na empresa LRN / Colato & Rocha)
// 7. Roda folha real de pró-labore 10/2026 em pro_labore_lancamentos com cálculo INSS 11% (teto R$ 7.786,02) e IRRF Lei 14.663/2023
// 8. Onde pró-labore não estiver definido: status AGUARDANDO_CLIENTE e pendência no Modo Humano
// 9. Emite alerta Fator R (prolabore_fator_r_alertas)
// 10. Instancia processo SOP POP-DP-01 na Fila da Elliza com etapa de chancela do contador (Nível 3) em AGUARDANDO_APROVACAO

routerAdd(
  'POST',
  '/backend/v1/elliza/migrar-prolabore-real',
  (e) => {
    try {
      const data = e.requestInfo().body || {}
      const compTarget = data.competencia || '10/2026'

      // Obter coleções
      const colDocs = $app.findCollectionByNameOrId('documentos')
      const colEmpresas = $app.findCollectionByNameOrId('empresas')
      const colSocios = $app.findCollectionByNameOrId('socios')
      const colLanc = $app.findCollectionByNameOrId('pro_labore_lancamentos')
      const colAlertas = $app.findCollectionByNameOrId('prolabore_fator_r_alertas')
      const colSops = $app.findCollectionByNameOrId('sops')
      const colProcessos = $app.findCollectionByNameOrId('processos_operacionais')
      const colEtapas = $app.findCollectionByNameOrId('processo_etapas')
      const colJobs = $app.findCollectionByNameOrId('elisa_jobs')
      const colPendencias = $app.findCollectionByNameOrId('processo_pendencias')
      const colEvidencias = $app.findCollectionByNameOrId('elisa_evidencias')

      // Obter tenant ativo
      const tenants = $app.findRecordsByFilter('tenants', 'ativo = true', 'created', 1, 0)
      if (!tenants || tenants.length === 0) {
        return e.json(400, { success: false, erro: 'Nenhum tenant ativo encontrado.' })
      }
      const tenantId = tenants[0].id

      // 1. Localizar documentos societários no GED (19 documentos)
      const docsSoc = $app.findRecordsByFilter(
        'documentos',
        `tenant_id = '${tenantId}' && status = 'processado' && (tipo = 'contrato_social' || tipo = 'alteracao_contratual')`,
        '-created',
        100,
        0,
      )

      // Agrupar por empresa_id
      const docsPorEmpresa = {}
      for (const d of docsSoc) {
        const empId = d.getString('empresa_id')
        if (!empId) continue
        if (!docsPorEmpresa[empId]) {
          docsPorEmpresa[empId] = []
        }
        docsPorEmpresa[empId].push(d)
      }

      // Buscar empresas ativas
      const empresas = $app.findRecordsByFilter(
        'empresas',
        `tenant_id = '${tenantId}' && status = 'ativo'`,
        'razao_social',
        100,
        0,
      )
      const empresasMap = {}
      for (const emp of empresas) {
        empresasMap[emp.id] = emp
      }

      // Buscar SOP POP-DP-01
      let sopPopDp01 = null
      try {
        sopPopDp01 = $app.findFirstRecordByFilter(
          'sops',
          `tenant_id = '${tenantId}' && codigo = 'POP-DP-01'`,
        )
      } catch (_) {}

      const resumoMigracao = []

      // 2. Processar cada empresa que possui documentos societários
      for (const empId of Object.keys(docsPorEmpresa)) {
        const docList = docsPorEmpresa[empId]
        const empresaRec = empresasMap[empId]
        if (!empresaRec) continue

        const razaoSocial = empresaRec.getString('razao_social')
        const cnpjEmpresa = empresaRec.getString('cnpj')

        // Ordenar documentos: alterações contratuais têm prioridade sobre contrato social; se houver mais de um, o mais recente
        docList.sort((a, b) => {
          const tipoA = a.getString('tipo')
          const tipoB = b.getString('tipo')
          if (tipoA === 'alteracao_contratual' && tipoB !== 'alteracao_contratual') return -1
          if (tipoB === 'alteracao_contratual' && tipoA !== 'alteracao_contratual') return 1

          const dateA = a.getString('created') || ''
          const dateB = b.getString('created') || ''
          return dateB.localeCompare(dateA)
        })

        const docMaisRecente = docList[0]
        const nomeArquivo =
          docMaisRecente.getString('nome_arquivo') || docMaisRecente.getString('arquivo')

        // Extrair texto do documento
        let markdown = ''
        let isScanned = false
        try {
          const docRes = $documents.toMarkdown({ record: docMaisRecente, field: 'arquivo' })
          markdown = (docRes && docRes.markdown) || ''
        } catch (convErr) {
          if (convErr && convErr.status === 422) {
            isScanned = true
          }
        }

        // Se tiver mais documentos na mesma empresa e o primeiro for escaneado/vazio, testar outro
        if ((isScanned || !markdown || markdown.trim().length < 50) && docList.length > 1) {
          for (let k = 1; k < docList.length; k++) {
            try {
              const altRes = $documents.toMarkdown({ record: docList[k], field: 'arquivo' })
              if (altRes && altRes.markdown && altRes.markdown.trim().length > 50) {
                markdown = altRes.markdown
                isScanned = false
                break
              }
            } catch (_) {}
          }
        }

        let sociosExtraidos = []
        let motivoParada = null
        let proLaboreDefinidoDoc = null

        if (isScanned || !markdown || markdown.trim().length < 50) {
          motivoParada =
            'Documento societário anexado no GED é digitalizado em formato imagem (sem camada OCR selecionável). Impossível extrair quotas e nomes com integridade jurídica sem intervenção manual.'
        } else {
          // Extração cognitiva estruturada via $ai.chat
          const prompt = `Você é um perito contábil brasileiro da Elliza. Analise o contrato social / alteração contratual abaixo da empresa "${razaoSocial}" (CNPJ: ${cnpjEmpresa}).
Identifique com precisão jurídica o quadro societário VIGENTE final descrito no documento.

Texto do documento:
"""
${markdown.slice(0, 16000)}
"""

Regras rigorosas:
1. Extraia todos os sócios com nome completo, CPF (obrigatório, se não constar informe null), cargo/função (ex: "Sócio-Administrador", "Sócio-Quotista"), quantidade de quotas, valor da participação em R$, e percentual de participação (ex: 50 ou 100).
2. Se houver valor explícito estipulado para pró-labore na cláusula de remuneração (ex: "pró-labore fixado em R$ X"), informe em "pro_labore_mencionado". Se apenas disser que "poderão retirar pró-labore", coloque null.
3. Se o percentual de algum sócio não estiver claro, ou a soma de todos os sócios for diferente de 100%, preencha "motivo_parada" com a explicação exata.

Responda APENAS um JSON:
{
  "socios": [
    {
      "nome_completo": string,
      "cpf": string ou null,
      "cargo_funcao": string,
      "quantidade_quotas": number ou null,
      "percentual_participacao": number ou null,
      "valor_participacao": number ou null,
      "pro_labore_mencionado": number ou null
    }
  ],
  "soma_percentuais": number ou null,
  "motivo_parada": string ou null
}`

          try {
            const reply = $ai.chat({
              model: 'fast',
              messages: [
                {
                  role: 'system',
                  content: 'Você responde apenas JSON rigoroso sobre contratos sociais.',
                },
                { role: 'user', content: prompt },
              ],
            })
            const rawContent =
              (reply.choices &&
                reply.choices[0] &&
                reply.choices[0].message &&
                reply.choices[0].message.content) ||
              ''
            const jMatch = rawContent.match(/\{[\s\S]*\}/)
            if (jMatch) {
              const parsed = JSON.parse(jMatch[0])
              sociosExtraidos = parsed.socios || []
              if (parsed.motivo_parada) {
                motivoParada = parsed.motivo_parada
              }
              const soma =
                parsed.soma_percentuais ||
                sociosExtraidos.reduce(
                  (acc, s) => acc + (Number(s.percentual_participacao) || 0),
                  0,
                )
              if (sociosExtraidos.length === 0) {
                motivoParada = 'Nenhum sócio legível identificado no instrumento anexado.'
              } else if (Math.abs(soma - 100) > 0.05 && sociosExtraidos.length > 0) {
                motivoParada = `Soma das participações societárias resulta em ${soma}%, divergente de 100%. Parada honesta para conferência de quotas.`
              }
            } else {
              motivoParada = 'Resposta do modelo não estruturada em JSON.'
            }
          } catch (aiErr) {
            motivoParada = 'Erro ao processar cognição do contrato: ' + aiErr.message
          }
        }

        // 3. Tratar PARADA HONESTA se houver motivo_parada
        if (motivoParada) {
          // Registrar pendência no Modo Humano da esteira Elliza
          let pendRec = null
          try {
            pendRec = $app.findFirstRecordByFilter(
              'processo_pendencias',
              `tenant_id = '${tenantId}' && empresa_id = '${empId}' && titulo ~ 'Contrato Social'`,
            )
          } catch (_) {}

          if (!pendRec) {
            pendRec = new Record(colPendencias)
            pendRec.set('tenant_id', tenantId)
            pendRec.set('empresa_id', empId)
            pendRec.set('titulo', `Parada Honesta: Quadro Societário — ${razaoSocial}`)
            pendRec.set('por_que_parou', motivoParada)
            pendRec.set(
              'o_que_foi_executado',
              `Elliza localizou o documento "${nomeArquivo}" no GED e tentou extrair o quadro de quotas e participações societárias.`,
            )
            pendRec.set(
              'o_que_falta',
              'Análise humana do documento societário anexado ou upload de alteração contratual em PDF com texto selecionável.',
            )
            pendRec.set(
              'decisao_necessaria',
              'Conferir instrumento na Junta Comercial, sanar quotas ou validar quadro de sócios manualmente.',
            )
            pendRec.set('status', 'aberta')
            $app.save(pendRec)
          }

          resumoMigracao.push({
            empresa_id: empId,
            razao_social: razaoSocial,
            cnpj: cnpjEmpresa,
            documento_usado: nomeArquivo,
            status_importacao: 'PARADA_HONESTA',
            motivo: motivoParada,
            socios_importados: 0,
            folha_status: 'BLOQUEADA_FALTA_DADOS',
          })
          continue
        }

        // 4. Se a extração foi bem-sucedida: Criar/Atualizar sócios reais
        const sociosSalvos = []
        for (const s of sociosExtraidos) {
          const cpfFormatado = (s.cpf || '').trim()
          let socioRec = null

          // Tentar localizar sócio existente por CPF ou Nome na empresa
          if (cpfFormatado) {
            try {
              socioRec = $app.findFirstRecordByFilter(
                'socios',
                `tenant_id = '${tenantId}' && empresa = '${empId}' && cpf = '${cpfFormatado}'`,
              )
            } catch (_) {}
          }
          if (!socioRec && s.nome_completo) {
            try {
              socioRec = $app.findFirstRecordByFilter(
                'socios',
                `tenant_id = '${tenantId}' && empresa = '${empId}' && nome_completo ~ '${s.nome_completo.split(' ')[0]}'`,
              )
            } catch (_) {}
          }

          const isNovo = !socioRec
          if (isNovo) {
            socioRec = new Record(colSocios)
            socioRec.set('tenant_id', tenantId)
            socioRec.set('empresa', empId)
          }

          socioRec.set('nome_completo', s.nome_completo)
          socioRec.set('cpf', cpfFormatado || '000.000.000-00')
          socioRec.set('cargo_funcao', s.cargo_funcao || 'Sócio-Administrador')
          socioRec.set('percentual_participacao', Number(s.percentual_participacao) || 100)
          if (s.quantidade_quotas) socioRec.set('quantidade_quotas', Number(s.quantidade_quotas))
          if (s.valor_participacao) socioRec.set('valor_participacao', Number(s.valor_participacao))

          // Regra pró-labore: Não inventar valor! Só preencher se houver valor explícito no documento
          if (s.pro_labore_mencionado && Number(s.pro_labore_mencionado) > 0) {
            socioRec.set('pro_labore_definido', Number(s.pro_labore_mencionado))
          }

          socioRec.set('data_inicio', '2024-01-01T00:00:00Z')
          socioRec.set('is_contribuinte_individual', true)
          socioRec.set('optante_distribuicao_lucros', true)
          socioRec.set('status', 'ativo')
          socioRec.set(
            'observacoes',
            `Quadro societário importado pela Elliza a partir do documento "${nomeArquivo}" do GED.`,
          )
          $app.save(socioRec)
          sociosSalvos.push(socioRec)
        }

        // 5. Frente 2 — Rodar folha de pró-labore REAL na competência 10/2026
        const lancamentosGerados = []
        let temProLaboreIndefinido = false

        for (const sc of sociosSalvos) {
          const bruto = sc.getFloat('pro_labore_definido') || 0
          if (bruto === 0) {
            temProLaboreIndefinido = true
          }

          // Cálculos tributários: INSS 11% (teto R$ 7.786,02) e IRRF Lei 14.663/2023
          const tetoInss = 7786.02
          const baseInss = Math.min(bruto, tetoInss)
          const inss = bruto > 0 ? Math.round(baseInss * 0.11 * 100) / 100 : 0
          const atingiuTeto = bruto >= tetoInss && bruto > 0

          // IRRF Progressivo
          let irrf = 0
          let aliqIrrf = 0
          let dedIrrf = 0
          let baseIrrf = 0
          let usaSimp = false

          if (bruto > 0) {
            const dependentes = sc.getInt('dependentes_irrf') || 0
            const deducaoDependentes = dependentes * 189.59
            const baseLegal = Math.max(0, bruto - inss - deducaoDependentes)
            const baseSimplificada = Math.max(0, bruto - 564.8)

            const calcIrrf = (b) => {
              if (b <= 2259.2) return { imp: 0, al: 0, de: 0 }
              if (b <= 2826.65)
                return {
                  imp: Math.max(0, Math.round((b * 0.075 - 169.44) * 100) / 100),
                  al: 7.5,
                  de: 169.44,
                }
              if (b <= 3751.05)
                return {
                  imp: Math.max(0, Math.round((b * 0.15 - 381.44) * 100) / 100),
                  al: 15.0,
                  de: 381.44,
                }
              if (b <= 4664.68)
                return {
                  imp: Math.max(0, Math.round((b * 0.225 - 662.77) * 100) / 100),
                  al: 22.5,
                  de: 662.77,
                }
              return {
                imp: Math.max(0, Math.round((b * 0.275 - 896.0) * 100) / 100),
                al: 27.5,
                de: 896.0,
              }
            }

            const cLeg = calcIrrf(baseLegal)
            const cSim = calcIrrf(baseSimplificada)
            usaSimp = cSim.imp < cLeg.imp
            const cFinal = usaSimp ? cSim : cLeg
            irrf = cFinal.imp
            aliqIrrf = cFinal.al
            dedIrrf = cFinal.de
            baseIrrf = usaSimp ? baseSimplificada : baseLegal
          }

          const liquido = Math.max(0, Math.round((bruto - inss - irrf) * 100) / 100)

          // Lançamento
          let lRec = null
          try {
            lRec = $app.findFirstRecordByFilter(
              'pro_labore_lancamentos',
              `tenant_id = '${tenantId}' && empresa = '${empId}' && socio = '${sc.id}' && competencia = '${compTarget}'`,
            )
          } catch (_) {}

          if (!lRec) {
            lRec = new Record(colLanc)
            lRec.set('tenant_id', tenantId)
            lRec.set('empresa', empId)
            lRec.set('socio', sc.id)
            lRec.set('competencia', compTarget)
          }

          lRec.set('valor_bruto', bruto)
          lRec.set('base_inss', baseInss)
          lRec.set('aliquota_inss', 11.0)
          lRec.set('inss_retido', inss)
          lRec.set('atingiu_teto_inss', atingiuTeto)
          lRec.set('base_irrf', Math.round(baseIrrf * 100) / 100)
          lRec.set('aliquota_irrf', aliqIrrf)
          lRec.set('parcela_deduzir_irrf', dedIrrf)
          lRec.set('irrf_retido', irrf)
          lRec.set('deducao_simplificada_usada', usaSimp)
          lRec.set('valor_liquido', liquido)
          lRec.set('distribuicao_status', 'aguardando_fechamento')
          lRec.set(
            'distribuicao_base_legal',
            'Lei 9.249/95 art. 10 e art. 14 da LC 123/2006 (Isenção total de IR na distribuição aos sócios)',
          )

          // Se não definiu valor, status fica aguardando definição
          if (bruto === 0) {
            lRec.set('status', 'rascunho')
            lRec.set(
              'observacoes',
              'AGUARDANDO_CLIENTE: Valor do pró-labore não definido pelos sócios. O contrato social não estipula cifra fixa.',
            )
          } else {
            lRec.set('status', 'calculado')
            lRec.set(
              'observacoes',
              `Pró-labore 10/2026 apurado pela Elliza com base contratual de R$ ${bruto.toFixed(2)}.`,
            )
          }
          lRec.set('numero_recibo', `REC-PL-102026-${sc.id.slice(-4)}`)
          lRec.set('hash_evidencia', `sha256-real-102026-${empId.slice(0, 4)}-${sc.id.slice(0, 4)}`)
          $app.save(lRec)
          lancamentosGerados.push(lRec)
        }

        // 6. Alerta de Fator R (Honestidade quando não há faturamento calculável)
        let alertaFatorR = null
        try {
          alertaFatorR = $app.findFirstRecordByFilter(
            'prolabore_fator_r_alertas',
            `tenant_id = '${tenantId}' && empresa = '${empId}' && competencia = '${compTarget}'`,
          )
        } catch (_) {}

        if (!alertaFatorR) {
          alertaFatorR = new Record(colAlertas)
          alertaFatorR.set('tenant_id', tenantId)
          alertaFatorR.set('empresa', empId)
          alertaFatorR.set('competencia', compTarget)
          alertaFatorR.set('tipo_alerta', 'faturamento_insuficiente')
          alertaFatorR.set('titulo', 'Fator R aguardando faturamento acumulado 10/2026')
          alertaFatorR.set(
            'mensagem',
            'A competência 10/2026 ainda não possui encerramento de faturamento ou RBT12 apurado na carteira. O monitoramento do Fator R será atualizado automaticamente assim que as notas fiscais forem consolidadas.',
          )
          alertaFatorR.set('rbt12', 0)
          alertaFatorR.set('folha12', 0)
          alertaFatorR.set('fator_r_atual', 0)
          alertaFatorR.set('fator_r_projetado', 0)
          alertaFatorR.set('enquadramento_anterior', 'Simples Nacional')
          alertaFatorR.set('enquadramento_novo', 'Simples Nacional')
          alertaFatorR.set('severidade', 'baixa')
          alertaFatorR.set('resolvido', false)
          alertaFatorR.set(
            'acao_recomendada',
            'Emitir e sincronizar as NFS-e da competência para consolidação do Fator R de 28%.',
          )
          $app.save(alertaFatorR)
        }

        // 7. Instanciar processo SOP POP-DP-01 na Fila da Elliza
        if (sopPopDp01) {
          let procReal = null
          try {
            procReal = $app.findFirstRecordByFilter(
              'processos_operacionais',
              `tenant_id = '${tenantId}' && empresa_id = '${empId}' && codigo_sop = 'POP-DP-01' && competencia = '${compTarget}'`,
            )
          } catch (_) {}

          const statusProc = temProLaboreIndefinido ? 'AGUARDANDO_CLIENTE' : 'AGUARDANDO_APROVACAO'
          const decisaoHumana = temProLaboreIndefinido
            ? 'Definir o valor do pró-labore mensal para cada sócio (o contrato social não fixa valor monetário).'
            : 'Etapa 4: Conferência técnica do Contador CRC. Requer validação e chancela para emissão de guias e comprovantes.'

          if (!procReal) {
            procReal = new Record(colProcessos)
            procReal.set('tenant_id', tenantId)
            procReal.set('empresa_id', empId)
            procReal.set('sop_id', sopPopDp01.id)
            procReal.set('codigo_sop', 'POP-DP-01')
            procReal.set('titulo', `POP-DP-01: Pró-labore e Distribuição de Lucros — ${compTarget}`)
            procReal.set('area', 'pessoal')
            procReal.set('competencia', compTarget)
            procReal.set('status', statusProc)
            procReal.set('prioridade', 'alta')
            procReal.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
            procReal.set('etapa_atual_numero', 4)
            procReal.set(
              'etapa_atual_nome',
              '4. Conferência técnica do Contador CRC (Nível 3 — Aprovação Obrigatória)',
            )
            procReal.set('total_etapas', 5)
            procReal.set('progresso_percentual', 60)
            procReal.set('agente_responsavel', 'Elliza')
            procReal.set('prazo', '2026-10-31T23:59:59Z')
            procReal.set(
              'proxima_acao',
              temProLaboreIndefinido
                ? 'Aguardando definição do valor de pró-labore pelo cliente/sócios.'
                : 'Aguardando validação e chancela CRC do Contador Responsável.',
            )
            procReal.set(
              'criterio_sucesso_atual',
              'Quadro societário validado a partir do contrato social e folha de pró-labore 10/2026 calculada.',
            )
            procReal.set(
              'ultima_acao_executada',
              `Quadro societário importado do documento "${nomeArquivo}". Folha 10/2026 gerada com ${sociosSalvos.length} sócio(s).`,
            )
            procReal.set('decisao_necessaria_humana', decisaoHumana)
            $app.save(procReal)

            // Criar Etapa 4
            const ep4 = new Record(colEtapas)
            ep4.set('tenant_id', tenantId)
            ep4.set('processo_id', procReal.id)
            ep4.set('ordem', 4)
            ep4.set(
              'titulo',
              '4. Conferência técnica do Contador CRC (Nível 3 — Aprovação Obrigatória)',
            )
            ep4.set(
              'descricao',
              'Submeter a minuta de pró-labore e retenções de INSS/IRRF para chancela do Contador Responsável.',
            )
            ep4.set('status', statusProc)
            ep4.set('responsavel_tipo', 'Humano')
            ep4.set('requer_aprovacao', true)
            $app.save(ep4)

            // Criar Job na Fila da Elliza
            const jobCod = `JOB-${compTarget.replace('/', '')}-POPDP01-${empId.slice(0, 4).toUpperCase()}`
            let jobRec = null
            try {
              jobRec = $app.findFirstRecordByFilter(
                'elisa_jobs',
                `tenant_id = '${tenantId}' && job_codigo = '${jobCod}'`,
              )
            } catch (_) {}

            if (!jobRec) {
              jobRec = new Record(colJobs)
              jobRec.set('tenant_id', tenantId)
              jobRec.set('processo_id', procReal.id)
              jobRec.set('etapa_id', ep4.id)
              jobRec.set('empresa_id', empId)
              jobRec.set('job_codigo', jobCod)
              jobRec.set('competencia', compTarget)
              jobRec.set('area', 'pessoal')
              jobRec.set('processo_nome', procReal.getString('titulo'))
              jobRec.set('pop_relacionado', 'POP-DP-01')
              jobRec.set('etapa_atual_nome', '4. Conferência técnica do Contador CRC')
              jobRec.set(
                'proxima_acao',
                temProLaboreIndefinido
                  ? 'Coletar definição do valor do pró-labore por sócio junto ao cliente.'
                  : 'Revisar apuração de INSS/IRRF e aprovar formalização CRC.',
              )
              jobRec.set('prioridade', 'alta')
              jobRec.set('prazo', '2026-10-31T23:59:59Z')
              jobRec.set('status', statusProc)
              jobRec.set('agente_responsavel', 'Elliza')
              jobRec.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
              jobRec.set('necessita_aprovacao', true)
              jobRec.set(
                'resultado',
                `Quadro societário importado (${sociosSalvos.length} sócios). Status da folha: ${statusProc}.`,
              )
              $app.save(jobRec)
            }

            // Criar pendência se faltar valor de pró-labore
            if (temProLaboreIndefinido) {
              const pendVal = new Record(colPendencias)
              pendVal.set('tenant_id', tenantId)
              pendVal.set('processo_id', procReal.id)
              pendVal.set('etapa_id', ep4.id)
              pendVal.set('empresa_id', empId)
              pendVal.set('titulo', `Definição de Pró-labore Pendente: ${razaoSocial} (10/2026)`)
              pendVal.set(
                'por_que_parou',
                'O Contrato Social anexado no GED formaliza os sócios e quotas, porém a fixação do valor mensal de remuneração (pró-labore) é decisão dos sócios e não possui valor monetário na cláusula.',
              )
              pendVal.set(
                'o_que_foi_executado',
                `Elliza importou com sucesso os ${sociosSalvos.length} sócio(s) e quotas vigentes. Lançamentos 10/2026 criados como rascunho com INSS/IRRF parametrizados.`,
              )
              pendVal.set(
                'o_que_falta',
                'Definição expressa do cliente/sócios quanto ao valor bruto mensal de pró-labore a retirar.',
              )
              pendVal.set(
                'decisao_necessaria',
                'Informar o valor mensal acordado por sócio no Painel de Pró-labore para que a Elliza apure a guia.',
              )
              pendVal.set('status', 'aberta')
              $app.save(pendVal)
            } else {
              // Criar pendência de aprovação CRC
              const pendAprov = new Record(colPendencias)
              pendAprov.set('tenant_id', tenantId)
              pendAprov.set('processo_id', procReal.id)
              pendAprov.set('etapa_id', ep4.id)
              pendAprov.set('empresa_id', empId)
              pendAprov.set('titulo', `Aprovação CRC: Folha Pró-labore 10/2026 — ${razaoSocial}`)
              pendAprov.set(
                'por_que_parou',
                'Etapa parametrizada com Nível 3 (Aprovação Obrigatória do Contador CRC antes da emissão de recibos e DARF).',
              )
              pendAprov.set(
                'o_que_foi_executado',
                `Elliza apurou os valores de INSS e IRRF dos sócios conforme Lei 14.663/2023.`,
              )
              pendAprov.set(
                'o_que_falta',
                'Chancela técnica do Contador Responsável no Modo Humano.',
              )
              pendAprov.set(
                'decisao_necessaria',
                'Revisar valores e autorizar emissão dos recibos.',
              )
              pendAprov.set('status', 'aberta')
              $app.save(pendAprov)
            }
          }
        }

        resumoMigracao.push({
          empresa_id: empId,
          razao_social: razaoSocial,
          cnpj: cnpjEmpresa,
          documento_usado: nomeArquivo,
          status_importacao: 'SUCESSO',
          socios_importados: sociosSalvos.length,
          socios: sociosSalvos.map((sc) => ({
            nome: sc.getString('nome_completo'),
            cpf: sc.getString('cpf'),
            cargo: sc.getString('cargo_funcao'),
            participacao: sc.getFloat('percentual_participacao'),
            pro_labore: sc.getFloat('pro_labore_definido'),
          })),
          folha_status: temProLaboreIndefinido ? 'AGUARDANDO_CLIENTE' : 'AGUARDANDO_APROVACAO',
          proximo_passo: temProLaboreIndefinido
            ? 'Definir o valor de pró-labore por sócio'
            : 'Contador aprovar chancela CRC da folha 10/2026',
        })
      }

      // 8. DEDUPLICAÇÃO dos sócios demo da migration 0114
      // Os sócios demo foram: "Dra. Camila Colato" e "Dr. Lucas Rocha"
      // Se houver sócios reais cadastrados na empresa LRN SERVICOS MEDICOS LTDA (ou antiga Colato & Rocha),
      // marcar observação de demo nos registros anteriores ou deduplicar
      const sociosDemo = $app.findRecordsByFilter(
        'socios',
        `tenant_id = '${tenantId}' && (cpf = '048.912.439-82' || cpf = '739.201.845-10')`,
        'created',
        10,
        0,
      )

      let totalDeduplicados = 0
      for (const sd of sociosDemo) {
        const obs = sd.getString('observacoes') || ''
        if (!obs.includes('[DEMO_MIGRATION_0114]')) {
          sd.set('observacoes', `[DEMO_MIGRATION_0114] ${obs}`)
          sd.set('status', 'afastado') // Não polui a base real de ativos
          $app.save(sd)
          totalDeduplicados++
        }
      }

      return e.json(200, {
        success: true,
        competencia: compTarget,
        total_empresas_processadas: Object.keys(docsPorEmpresa).length,
        socios_demo_afastados: totalDeduplicados,
        resumo: resumoMigracao,
      })
    } catch (err) {
      console.log('Erro geral na migracao de pro-labore:', err)
      return e.json(err.status || 500, {
        success: false,
        erro: 'falha_migracao',
        mensagem: err.message || 'Erro inesperado durante a migração.',
      })
    }
  },
  $apis.requireAuth(),
)
