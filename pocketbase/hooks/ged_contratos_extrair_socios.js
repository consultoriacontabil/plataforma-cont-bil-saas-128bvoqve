// Hook: ged_contratos_extrair_socios.js
// Rota administrativa / backend para ler os documentos do GED vinculados às empresas
// e extrair dados societários reais utilizando $documents.toMarkdown e $ai.chat (Skip AI).

routerAdd(
  'POST',
  '/backend/v1/ged/extrair-documento-socios',
  (e) => {
    try {
      const data = e.requestInfo().body || {}
      const documentoId = data.documento_id

      if (!documentoId) {
        return e.json(400, { success: false, erro: 'ID do documento não informado.' })
      }

      const docRecord = $app.findRecordById('documentos', documentoId)
      if (!docRecord) {
        return e.json(404, { success: false, erro: 'Documento não encontrado no GED.' })
      }

      const arquivoNome = docRecord.getString('arquivo')
      if (!arquivoNome) {
        return e.json(400, { success: false, erro: 'Documento sem arquivo físico associado.' })
      }

      let markdown = ''
      let isScanned = false

      try {
        const docRes = $documents.toMarkdown({ record: docRecord, field: 'arquivo' })
        markdown = (docRes && docRes.markdown) || ''
      } catch (docErr) {
        if (docErr && docErr.status === 422) {
          isScanned = true
        } else {
          return e.json(500, {
            success: false,
            erro: 'falha_conversao',
            mensagem: docErr.message || 'Erro ao converter arquivo em markdown.',
          })
        }
      }

      if (isScanned || !markdown || markdown.trim().length < 50) {
        return e.json(200, {
          success: true,
          documento_id: documentoId,
          isScanned: true,
          socios: [],
          capital_social: null,
          total_quotas: null,
          motivo_parada: 'Documento digitalizado/imagem sem camada de OCR ou texto ilegível.',
        })
      }

      // Utilizar $ai.chat para estruturar os dados com segurança
      const prompt = `Você é um perito contábil e societário brasileiro da plataforma Elliza.
Analise o texto extraído deste Contrato Social / Alteração Contratual e extraia o quadro societário VIGENTE nele formalizado.

Texto do documento:
"""
${markdown.slice(0, 15000)}
"""

Retorne EXCLUSIVAMENTE um objeto JSON (sem markdown, sem preâmbulo, sem blocos de código adicionais além de JSON puro) com a seguinte estrutura:
{
  "sucesso": true,
  "tipo_documento_identificado": "contrato_social" | "alteracao_contratual" | "outro",
  "data_documento": "AAAA-MM-DD" ou null,
  "capital_social": number ou null,
  "valor_nominal_quota": number ou null,
  "total_quotas": number ou null,
  "pro_labore_previsto_em_clausula": boolean,
  "valor_pro_labore_contratual": number ou null,
  "socios": [
    {
      "nome_completo": string,
      "cpf": string (apenas dígitos ou formatado),
      "cargo_funcao": "Sócio-Administrador" | "Sócio-Quotista" | "Administrador Não Sócio" | "Titular",
      "quantidade_quotas": number ou null,
      "percentual_participacao": number ou null,
      "valor_participacao": number ou null,
      "pro_labore_mencionado": number ou null
    }
  ],
  "soma_percentuais": number ou null,
  "motivo_parada": string ou null (se faltar percentual, se for ilegível, se a soma for divergente de 100%, ou se for documento antigo/não societário)
}`

      let sociosExtraidos = []
      let somaPercentuais = null
      let motivoParada = null
      let capitalSocial = null
      let totalQuotas = null

      try {
        const reply = $ai.chat({
          model: 'fast',
          messages: [
            { role: 'system', content: 'Você extrai quadros societários em JSON estrito.' },
            { role: 'user', content: prompt },
          ],
        })

        const rawContent =
          (reply.choices &&
            reply.choices[0] &&
            reply.choices[0].message &&
            reply.choices[0].message.content) ||
          ''
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          sociosExtraidos = parsed.socios || []
          somaPercentuais = parsed.soma_percentuais
          motivoParada = parsed.motivo_parada
          capitalSocial = parsed.capital_social
          totalQuotas = parsed.total_quotas
        }
      } catch (aiErr) {
        motivoParada = 'Falha na interpretação cognitiva do documento: ' + aiErr.message
      }

      return e.json(200, {
        success: true,
        documento_id: documentoId,
        isScanned: false,
        socios: sociosExtraidos,
        soma_percentuais: somaPercentuais,
        motivo_parada: motivoParada,
        capital_social: capitalSocial,
        total_quotas: totalQuotas,
        markdown_length: markdown.length,
      })
    } catch (err) {
      console.log('Erro ao processar socios de documento GED:', err)
      return e.json(err.status || 500, {
        success: false,
        erro: 'falha_leitura',
        mensagem: err.message || 'Erro inesperado.',
      })
    }
  },
  $apis.requireAuth(),
)
