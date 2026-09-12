/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Buscar tenant principal e empresas
    let tenant
    try {
      tenant = app.findFirstRecordByData('tenants', 'nome', 'Rumo Consultoria Contábil')
    } catch (_) {
      tenant = app.findFirstRecordByData('tenants', 'ativo', true)
    }
    const tenantId = tenant.id

    let inova, graos
    try {
      inova = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
    } catch (_) {}
    try {
      graos = app.findFirstRecordByData('empresas', 'cnpj', '18.902.345/0001-88')
    } catch (_) {}

    // Buscar contador responsável
    let contador
    try {
      contador = app.findAuthRecordByEmail('_pb_users_auth_', 'carlos.silva@rumoconsultoria.com.br')
    } catch (_) {
      try {
        contador = app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'rumo@rumoconsultoriacontabil.com.br',
        )
      } catch (_) {}
    }
    const contadorId = contador ? contador.id : null

    // Atualizar nfse_config com valores padrão do Agente IA
    try {
      const cfg = app.findFirstRecordByData('nfse_config', 'tenant_id', tenantId)
      cfg.set('ia_ativa', true)
      cfg.set('ia_modo_operacao', 'autonomo_duvidas')
      cfg.set(
        'ia_mensagem_boas_vindas',
        'Olá! Sou o assistente virtual da Rumo Consultoria Contábil. Como posso ajudar sua empresa hoje? Posso consultar prazos de obrigações, guias de impostos, status de NFS-e ou documentos.',
      )
      cfg.set('ia_horario_inicio', '08:30')
      cfg.set('ia_horario_fim', '18:00')
      cfg.set(
        'ia_mensagem_fora_horario',
        'Olá! Nosso horário de atendimento é de segunda a sexta, das 08:30 às 18:00. Sua mensagem foi registrada e o contador responsável responderá no próximo dia útil.',
      )
      app.save(cfg)
    } catch (err) {
      console.log('Aviso ao atualizar nfse_config:', err)
    }

    // Criar conversa seed para INOVATECH
    if (inova) {
      try {
        const convCol = app.findCollectionByNameOrId('wa_atendimento_conversas')
        const msgCol = app.findCollectionByNameOrId('wa_atendimento_mensagens')

        // Idempotência
        let inovaConv
        try {
          inovaConv = app.findFirstRecordByData(
            'wa_atendimento_conversas',
            'contato_telefone',
            '5511987654321',
          )
        } catch (_) {
          inovaConv = new Record(convCol)
          inovaConv.set('tenant_id', tenantId)
          inovaConv.set('empresa', inova.id)
          inovaConv.set('contato_nome', 'Ana Beatriz (Financeiro Inovatech)')
          inovaConv.set('contato_telefone', '5511987654321')
          inovaConv.set('origem_chat_jid', '5511987654321@s.whatsapp.net')
          inovaConv.set('status', 'escalada_humano')
          inovaConv.set('escalonamento_motivo', 'ato_fiscal')
          inovaConv.set(
            'ultima_mensagem',
            'Preciso emitir uma NFS-e para a empresa Acme Tecnologia no valor de R$ 3.850,00.',
          )
          inovaConv.set('ultima_interacao', '2026-09-12 14:15:00.000Z')
          inovaConv.set('total_mensagens', 6)
          inovaConv.set('total_respostas_ia', 2)
          inovaConv.set('total_respostas_humano', 1)
          if (contadorId) inovaConv.set('atendente_humano', contadorId)
          app.save(inovaConv)

          // Mensagens Inovatech
          const m1 = new Record(msgCol)
          m1.set('tenant_id', tenantId)
          m1.set('conversa', inovaConv.id)
          m1.set('remetente_tipo', 'cliente')
          m1.set(
            'conteudo',
            'Olá! Gostaria de saber qual o prazo da nossa próxima obrigação e se o DAS deste mês já está disponível.',
          )
          m1.set('status_envio', 'enviada')
          app.save(m1)

          const m2 = new Record(msgCol)
          m2.set('tenant_id', tenantId)
          m2.set('conversa', inovaConv.id)
          m2.set('remetente_tipo', 'ia')
          m2.set(
            'conteudo',
            'Olá, Ana! Localizei as informações da Inovatech Soluções Digitais Ltda:\n\n• Próxima Obrigação: DAS (Simples Nacional) da competência 08/2026 no valor de R$ 4.320,50 com vencimento em 14/09/2026 (status: pendente).\n• Guia DARF Previdenciário (DCTFWeb 08/2026): R$ 5.170,50 já se encontra paga e conciliada.\n\nPosso ajudar em algo mais?',
          )
          m2.set('status_envio', 'enviada')
          app.save(m2)

          const m3 = new Record(msgCol)
          m3.set('tenant_id', tenantId)
          m3.set('conversa', inovaConv.id)
          m3.set('remetente_tipo', 'cliente')
          m3.set(
            'conteudo',
            'Perfeito! Além disso, preciso emitir uma NFS-e para a empresa Acme Tecnologia Brasil Ltda, CNPJ 12.345.678/0001-90, no valor de R$ 3.850,00, serviço de desenvolvimento de software.',
          )
          m3.set('status_envio', 'enviada')
          app.save(m3)

          const m4 = new Record(msgCol)
          m4.set('tenant_id', tenantId)
          m4.set('conversa', inovaConv.id)
          m4.set('remetente_tipo', 'ia')
          m4.set(
            'conteudo',
            'Entendido! Conforme o padrão de segurança e conformidade do nosso escritório (modo assistivo), a emissão de documentos fiscais requer aprovação contábil. Já estruturei todos os dados da Acme Tecnologia (R$ 3.850,00) e encaminhei imediatamente para o Painel de Supervisão do contador responsável. Você receberá o DANFSE e XML assim que aprovada!',
          )
          m4.set('status_envio', 'enviada')
          app.save(m4)

          const m5 = new Record(msgCol)
          m5.set('tenant_id', tenantId)
          m5.set('conversa', inovaConv.id)
          m5.set('remetente_tipo', 'sistema')
          m5.set(
            'conteudo',
            '[Escalonamento Automático]: Solicitação de emissão de NFS-e protocolada na fila de supervisão contábil. Conversa atribuída ao contador Carlos Silva.',
          )
          m5.set('status_envio', 'enviada')
          app.save(m5)

          const m6 = new Record(msgCol)
          m6.set('tenant_id', tenantId)
          m6.set('conversa', inovaConv.id)
          m6.set('remetente_tipo', 'humano')
          m6.set(
            'conteudo',
            'Olá Ana, Carlos aqui da Rumo. Já conferi a alíquota de ISS e os dados cadastrais da Acme Tecnologia no nosso painel. A nota fiscal já foi autorizada e o arquivo está sendo gerado.',
          )
          m6.set('status_envio', 'enviada')
          if (contadorId) m6.set('aprovado_por', contadorId)
          app.save(m6)
        }
      } catch (errInova) {
        console.log('Erro seed Inovatech:', errInova)
      }
    }

    // Criar conversa seed para GRÃOS DO SUL
    if (graos) {
      try {
        const convCol = app.findCollectionByNameOrId('wa_atendimento_conversas')
        const msgCol = app.findCollectionByNameOrId('wa_atendimento_mensagens')

        // Idempotência
        let graosConv
        try {
          graosConv = app.findFirstRecordByData(
            'wa_atendimento_conversas',
            'contato_telefone',
            '5541999881122',
          )
        } catch (_) {
          graosConv = new Record(convCol)
          graosConv.set('tenant_id', tenantId)
          graosConv.set('empresa', graos.id)
          graosConv.set('contato_nome', 'Marcos Oliveira (Grãos do Sul)')
          graosConv.set('contato_telefone', '5541999881122')
          graosConv.set('origem_chat_jid', '5541999881122@s.whatsapp.net')
          graosConv.set('status', 'resolvida_ia')
          graosConv.set('ultima_mensagem', 'Muito obrigado pela consulta rápida!')
          graosConv.set('ultima_interacao', '2026-09-12 11:30:00.000Z')
          graosConv.set('total_mensagens', 4)
          graosConv.set('total_respostas_ia', 2)
          graosConv.set('total_respostas_humano', 0)
          app.save(graosConv)

          const g1 = new Record(msgCol)
          g1.set('tenant_id', tenantId)
          g1.set('conversa', graosConv.id)
          g1.set('remetente_tipo', 'cliente')
          g1.set(
            'conteudo',
            'Bom dia! Gostaria de verificar a situação da guia do DAS da Grãos do Sul referente a agosto.',
          )
          g1.set('status_envio', 'enviada')
          app.save(g1)

          const g2 = new Record(msgCol)
          g2.set('tenant_id', tenantId)
          g2.set('conversa', graosConv.id)
          g2.set('remetente_tipo', 'ia')
          g2.set(
            'conteudo',
            'Bom dia, Marcos! Verifiquei no sistema contábil da Café & Grãos Gourmet do Sul Comércio Ltda:\n\n• Guia DAS (08/2026): O valor original é R$ 3.120,80 (total com encargos R$ 3.276,84). Atenção: a guia consta com situação "vencida" desde 17/09/2026.\n• Próximo DARF Previdenciário (09/2026): R$ 159,50 com vencimento em 25/10/2026.\n\nRecomendamos a regularização do DAS para evitar encargos adicionais ou exclusão do regime.',
          )
          g2.set('status_envio', 'enviada')
          app.save(g2)

          const g3 = new Record(msgCol)
          g3.set('tenant_id', tenantId)
          g3.set('conversa', graosConv.id)
          g3.set('remetente_tipo', 'cliente')
          g3.set(
            'conteudo',
            'Certo, vamos efetuar o pagamento ainda hoje. Muito obrigado pela consulta rápida!',
          )
          g3.set('status_envio', 'enviada')
          app.save(g3)

          const g4 = new Record(msgCol)
          g4.set('tenant_id', tenantId)
          g4.set('conversa', graosConv.id)
          g4.set('remetente_tipo', 'ia')
          g4.set(
            'conteudo',
            'Por nada, Marcos! Qualquer outra dúvida sobre guias, notas fiscais ou certidões negativas, estou à disposição. Tenha um excelente dia!',
          )
          g4.set('status_envio', 'enviada')
          app.save(g4)
        }
      } catch (errGraos) {
        console.log('Erro seed Grãos:', errGraos)
      }
    }
  },
  (app) => {
    // Reverter seeds de conversas
    try {
      const msgs = app.findRecordsByFilter(
        'wa_atendimento_mensagens',
        'id != ""',
        '-created',
        100,
        0,
      )
      for (const m of msgs) {
        try {
          app.delete(m)
        } catch (_) {}
      }
    } catch (_) {}
    try {
      const convs = app.findRecordsByFilter(
        'wa_atendimento_conversas',
        'id != ""',
        '-created',
        100,
        0,
      )
      for (const c of convs) {
        try {
          app.delete(c)
        } catch (_) {}
      }
    } catch (_) {}
  },
)
