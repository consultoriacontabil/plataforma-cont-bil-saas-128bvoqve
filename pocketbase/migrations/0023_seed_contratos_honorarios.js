/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findRecordsByFilter('tenants', 'ativo = true', '-created', 1, 0)
    if (!tenants || tenants.length === 0) return
    const primaryTenant = tenants[0]

    const empresasInovatech = app.findRecordsByFilter(
      'empresas',
      `tenant_id = '${primaryTenant.id}' && (razao_social ~ 'Inovatech' || nome_fantasia ~ 'Inovatech')`,
      '',
      1,
      0,
    )
    const empresaInovatech = empresasInovatech.length > 0 ? empresasInovatech[0] : null

    const empresasGraos = app.findRecordsByFilter(
      'empresas',
      `tenant_id = '${primaryTenant.id}' && (razao_social ~ 'Grãos' || nome_fantasia ~ 'Grãos')`,
      '',
      1,
      0,
    )
    const empresaGraos = empresasGraos.length > 0 ? empresasGraos[0] : null

    const users = app.findRecordsByFilter('_pb_users_auth_', '', '-created', 1, 0)
    const adminUser = users.length > 0 ? users[0] : null

    const contratosCol = app.findCollectionByNameOrId('contratos_honorarios')
    const assinaturasCol = app.findCollectionByNameOrId('assinaturas_demonstrativos')

    // Cláusulas padrão completas de prestação de serviços contábeis
    const clausulasPadrao = [
      {
        titulo: 'Cláusula 1ª — Do Objeto e Escopo dos Serviços',
        texto:
          'O presente contrato tem por objeto a prestação de serviços contábeis, fiscais e de departamento pessoal pela CONTRATADA à CONTRATANTE, compreendendo: escrituração dos livros contábeis obrigatórios (Diário e Razão), apuração dos tributos municipais, estaduais e federais com emissão de guias (DAS/DARF), processamento mensal da folha de pagamento, pró-labore, e-Social e envio das obrigações acessórias regulatórias (DCTF, SPED, ECF, ECD).',
      },
      {
        titulo: 'Cláusula 2ª — Dos Honorários e Forma de Pagamento',
        texto:
          'Pelos serviços contratados, a CONTRATANTE pagará à CONTRATADA o valor mensal acordado, com vencimento impreterivelmente no dia estipulado de cada mês, mediante boleto bancário ou transferência PIX para a conta informada pelo escritório contábil.',
      },
      {
        titulo: 'Cláusula 3ª — Do Reajuste Anual pela Inflação',
        texto:
          'O valor dos honorários contábeis será reajustado anualmente a cada 12 (doze) meses de vigência, com base na variação acumulada do IPCA/IBGE ou, na sua ausência, pelo IGP-M/FGV, assegurando o equilíbrio econômico-financeiro da prestação.',
      },
      {
        titulo: 'Cláusula 4ª — Das Obrigações da Contratante',
        texto:
          'A CONTRATANTE obriga-se a fornecer à CONTRATADA, até o 5º (quinto) dia útil do mês subsequente, todos os documentos hábeis, extratos bancários conciliados, notas fiscais e comprovantes necessários para a regular escrituração contábil e apuração tributária.',
      },
      {
        titulo: 'Cláusula 5ª — Da Confidencialidade e LGPD (Lei 13.709/2018)',
        texto:
          'As partes comprometem-se a manter absoluto sigilo de todas as informações comerciais, técnicas e financeiras trocadas, bem como a tratar dados pessoais estritamente nos limites da Lei Geral de Proteção de Dados (LGPD) e das normas do Conselho Federal de Contabilidade (CFC).',
      },
      {
        titulo: 'Cláusula 6ª — Do Prazo e Rescisão Contratual',
        texto:
          'Este contrato vigorará pelo prazo acordado, podendo ser prorrogado por mútuo consentimento. Qualquer das partes poderá rescindi-lo mediante aviso prévio por escrito e protocolado com antecedência mínima de 30 (trinta) dias.',
      },
      {
        titulo: 'Cláusula 7ª — Da Integridade e Assinatura Digital',
        texto:
          'As partes reconhecem a validade jurídica das assinaturas eletrônicas e digitais realizadas pela plataforma Rumo Consultoria Contábil, com registro de hash criptográfico SHA-256, endereço IP e carimbo de tempo, nos termos da MP 2.200-2/2001 e da Lei 14.063/2020.',
      },
      {
        titulo: 'Cláusula 8ª — Do Foro de Eleição',
        texto:
          'Fica eleito o foro da Comarca de São Paulo/SP para dirimir eventuais dúvidas ou litígios decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
      },
    ]

    // 1. Proposta em rascunho (prospect ou empresa Grãos do Sul)
    try {
      const existingRascunho = app.findRecordsByFilter(
        'contratos_honorarios',
        `tenant_id = '${primaryTenant.id}' && titulo ~ 'Proposta Contábil'`,
        '',
        1,
        0,
      )
      if (existingRascunho.length === 0) {
        const propRec = new Record(contratosCol)
        propRec.set('tenant_id', primaryTenant.id)
        if (empresaGraos) {
          propRec.set('empresa', empresaGraos.id)
        }
        propRec.set('titulo', 'Proposta Comercial Contábil 2026/2027 — Grãos do Sul Cafeteria')
        propRec.set('tipo', 'proposta')
        propRec.set('modelo_mensalidade', 'mensal_fixo')
        propRec.set('valor_mensal', 1850.0)
        propRec.set('dia_vencimento', 10)
        propRec.set('prazo_contrato', 12)
        propRec.set('data_inicio', '2026-10-01 00:00:00.000Z')
        propRec.set('clausulas', clausulasPadrao)
        propRec.set('status', 'rascunho')
        if (adminUser) propRec.set('criado_por', adminUser.id)
        app.save(propRec)
      }
    } catch (err) {
      console.log('Erro seed proposta rascunho:', err)
    }

    // 2. Contrato enviado aguardando assinatura da Inovatech
    let contratoInovatechId = ''
    try {
      const existingEnviado = app.findRecordsByFilter(
        'contratos_honorarios',
        `tenant_id = '${primaryTenant.id}' && titulo ~ 'Contrato de Prestação de Serviços — Inovatech'`,
        '',
        1,
        0,
      )
      if (existingEnviado.length === 0 && empresaInovatech) {
        const contRec = new Record(contratosCol)
        contRec.set('tenant_id', primaryTenant.id)
        contRec.set('empresa', empresaInovatech.id)
        contRec.set(
          'titulo',
          'Contrato de Prestação de Serviços Contábeis e Fiscais — Inovatech Software',
        )
        contRec.set('tipo', 'contrato')
        contRec.set('modelo_mensalidade', 'por_funcionario')
        contRec.set('valor_mensal', 3200.0)
        contRec.set('dia_vencimento', 15)
        contRec.set('prazo_contrato', 24)
        contRec.set('data_inicio', '2026-09-01 00:00:00.000Z')
        contRec.set('clausulas', clausulasPadrao)
        contRec.set('status', 'enviado')

        const congeladoData = {
          titulo: 'Contrato de Prestação de Serviços Contábeis e Fiscais — Inovatech Software',
          tipo: 'contrato',
          empresa: {
            id: empresaInovatech.id,
            razao_social: empresaInovatech.getString('razao_social'),
            nome_fantasia: empresaInovatech.getString('nome_fantasia'),
            cnpj: empresaInovatech.getString('cnpj'),
          },
          escritorio: {
            nome: primaryTenant.getString('nome'),
            cnpj: primaryTenant.getString('cnpj'),
            crc: 'CRC/SP 2SP034821/O',
          },
          modelo_mensalidade: 'por_funcionario',
          valor_mensal: 3200.0,
          dia_vencimento: 15,
          prazo_contrato: 24,
          data_inicio: '2026-09-01',
          clausulas: clausulasPadrao,
          gerado_em: '2026-09-15T10:00:00.000Z',
        }
        contRec.set('dados_congelados', congeladoData)
        if (adminUser) contRec.set('criado_por', adminUser.id)
        app.save(contRec)
        contratoInovatechId = contRec.id

        // Criar solicitação de assinatura vinculada ao contrato
        const hashConteudo = $security.sha256(JSON.stringify(congeladoData))
        const tokenVerificacao = 'RUMO-CTR-202609-' + $security.randomString(8).toUpperCase()

        try {
          const assRecord = new Record(assinaturasCol)
          assRecord.set('tenant_id', primaryTenant.id)
          assRecord.set('contrato', contRec.id)
          assRecord.set('tipo_documento', 'contrato_honorarios')
          assRecord.set('empresa', empresaInovatech.id)
          assRecord.set('competencia', '09/2026')
          assRecord.set('tipo_assinatura', 'eletronica_declarada')
          assRecord.set('tipo_certificado', 'nenhum')
          assRecord.set('assinante', 'Carlos Eduardo Silva')
          assRecord.set('cargo_cpf', 'Diretor Geral - CPF 123.456.789-00')
          assRecord.set('email_assinante', 'carlos.silva@inovatech.com.br')
          assRecord.set('hash_conteudo', hashConteudo)
          assRecord.set('hash_documentacao', 'CTR-SHA256-' + hashConteudo.slice(0, 16))
          assRecord.set('status', 'solicitada')
          assRecord.set('token_verificacao', tokenVerificacao)
          assRecord.set('data_solicitacao', '2026-09-15 10:15:00.000Z')
          assRecord.set('provedor', 'interno')
          assRecord.set('payload_provedor', {
            modo: 'declaratorio_interno',
            aviso: 'Assinatura de contrato de honorários aguardando manifestação do cliente.',
          })
          app.save(assRecord)
        } catch (errAss) {
          console.log('Erro ao salvar assinatura contrato enviado:', errAss)
        }
      }
    } catch (err) {
      console.log('Erro seed contrato enviado:', err)
    }

    // 3. Contrato já assinado com token/hash gerados
    try {
      let contAssinadoId = ''
      const existingAssinado = app.findRecordsByFilter(
        'contratos_honorarios',
        `tenant_id = '${primaryTenant.id}' && titulo ~ 'Contrato Anual'`,
        '',
        1,
        0,
      )
      if (existingAssinado.length === 0 && empresaInovatech) {
        const contAssinadoRec = new Record(contratosCol)
        contAssinadoRec.set('tenant_id', primaryTenant.id)
        contAssinadoRec.set('empresa', empresaInovatech.id)
        contAssinadoRec.set(
          'titulo',
          'Contrato Anual de Assessoria Contábil e BPO Financeiro — Inovatech',
        )
        contAssinadoRec.set('tipo', 'contrato')
        contAssinadoRec.set('modelo_mensalidade', 'mensal_fixo')
        contAssinadoRec.set('valor_mensal', 4500.0)
        contAssinadoRec.set('dia_vencimento', 5)
        contAssinadoRec.set('prazo_contrato', 12)
        contAssinadoRec.set('data_inicio', '2026-01-01 00:00:00.000Z')
        contAssinadoRec.set('clausulas', clausulasPadrao)
        contAssinadoRec.set('status', 'assinado')

        const congeladoDataAssinado = {
          titulo: 'Contrato Anual de Assessoria Contábil e BPO Financeiro — Inovatech',
          tipo: 'contrato',
          empresa: {
            id: empresaInovatech.id,
            razao_social: empresaInovatech.getString('razao_social'),
            nome_fantasia: empresaInovatech.getString('nome_fantasia'),
            cnpj: empresaInovatech.getString('cnpj'),
          },
          escritorio: {
            nome: primaryTenant.getString('nome'),
            cnpj: primaryTenant.getString('cnpj'),
            crc: 'CRC/SP 2SP034821/O',
          },
          modelo_mensalidade: 'mensal_fixo',
          valor_mensal: 4500.0,
          dia_vencimento: 5,
          prazo_contrato: 12,
          data_inicio: '2026-01-01',
          clausulas: clausulasPadrao,
          gerado_em: '2026-01-10T09:00:00.000Z',
        }
        contAssinadoRec.set('dados_congelados', congeladoDataAssinado)
        if (adminUser) contAssinadoRec.set('criado_por', adminUser.id)
        app.save(contAssinadoRec)
        contAssinadoId = contAssinadoRec.id
      } else if (existingAssinado.length > 0) {
        contAssinadoId = existingAssinado[0].id
      }

      if (contAssinadoId) {
        const existingAssAssinada = app.findRecordsByFilter(
          'assinaturas_demonstrativos',
          `tenant_id = '${primaryTenant.id}' && contrato = '${contAssinadoId}'`,
          '',
          1,
          0,
        )
        if (existingAssAssinada.length === 0) {
          const congelado =
            existingAssinado.length > 0 ? existingAssinado[0].get('dados_congelados') : null
          const hashConteudoAssinado = $security.sha256(
            JSON.stringify(congelado || { id: contAssinadoId }),
          )
          const tokenOficial = 'RUMO-CTR-202601-7X9B4K2M'

          const assRecordAssinado = new Record(assinaturasCol)
          assRecordAssinado.set('tenant_id', primaryTenant.id)
          assRecordAssinado.set('contrato', contAssinadoId)
          assRecordAssinado.set('tipo_documento', 'contrato_honorarios')
          if (empresaInovatech) assRecordAssinado.set('empresa', empresaInovatech.id)
          assRecordAssinado.set('competencia', '01/2026')
          assRecordAssinado.set('tipo_assinatura', 'eletronica_declarada')
          assRecordAssinado.set('tipo_certificado', 'nenhum')
          assRecordAssinado.set('assinante', 'Carlos Eduardo Silva')
          assRecordAssinado.set('cargo_cpf', 'Diretor Geral - CPF 123.456.789-00')
          assRecordAssinado.set('email_assinante', 'carlos.silva@inovatech.com.br')
          assRecordAssinado.set('hash_conteudo', hashConteudoAssinado)
          assRecordAssinado.set(
            'hash_documentacao',
            'CTR-SHA256-' + hashConteudoAssinado.slice(0, 16),
          )
          assRecordAssinado.set('status', 'assinada')
          assRecordAssinado.set('token_verificacao', tokenOficial)
          assRecordAssinado.set('data_solicitacao', '2026-01-10 09:30:00.000Z')
          assRecordAssinado.set('data_assinatura', '2026-01-10 14:22:15.000Z')
          assRecordAssinado.set('ip_assinatura', '189.120.45.12 (São Paulo - HTTPS Seguro)')
          assRecordAssinado.set('provedor', 'interno')
          assRecordAssinado.set('payload_provedor', {
            modo: 'declaratorio_interno',
            statusFinal: 'Assinado pelo declarante',
            concluidoEm: '2026-01-10T14:22:15.000Z',
            observacoes:
              'Contrato de honorários contábeis anual assinado e aprovado integralmente.',
          })
          app.save(assRecordAssinado)
        }
      }
    } catch (err) {
      console.log('Erro seed contrato assinado:', err)
    }
  },
  (app) => {
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM assinaturas_demonstrativos WHERE token_verificacao LIKE 'RUMO-CTR-%'",
        )
        .execute()
      app
        .db()
        .newQuery(
          "DELETE FROM contratos_honorarios WHERE titulo LIKE '%Inovatech%' OR titulo LIKE '%Grãos%'",
        )
        .execute()
    } catch (_) {}
  },
)
