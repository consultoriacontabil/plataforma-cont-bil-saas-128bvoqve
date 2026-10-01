// Hook: elliza_agent_chat.js
// Endpoints para o agente nativo Skip Cloud "ELLIZA"
// POST /backend/v1/elliza/chat - Chat com streaming ou resposta direta
// POST /backend/v1/elliza/conversations - Criar ou retomar conversa
// GET /backend/v1/elliza/status - Status das rotinas 24/7 (internas e dependentes de credenciais)

routerAdd(
  'POST',
  '/backend/v1/elliza/chat',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const message = (body.message || '').trim()
      const conversationId = body.conversation_id || null
      const tenantId = body.tenant_id

      if (!message) {
        return e.badRequestError('A mensagem não pode estar vazia')
      }

      // Obter ou criar conversa nativa no agente ELLIZA
      const conv = $ai.agent('elliza').getOrCreateConversation({
        user_id: userId,
        id: conversationId,
        title: message.length > 45 ? message.slice(0, 45) + '...' : message,
      })

      // Gravar cópia nas coleções da aplicação para persistência e visualização no app
      if (tenantId) {
        try {
          const convCol = $app.findCollectionByNameOrId('agent_conversations')
          let appConv
          try {
            appConv = $app.findFirstRecordByData('agent_conversations', 'id', conv.id)
          } catch (_) {
            appConv = new Record(convCol)
            appConv.set('id', conv.id)
            appConv.set('tenant_id', tenantId)
            appConv.set('user_id', userId)
            appConv.set('titulo', message.length > 45 ? message.slice(0, 45) + '...' : message)
            $app.save(appConv)
          }

          const msgCol = $app.findCollectionByNameOrId('agent_messages')
          const userMsg = new Record(msgCol)
          userMsg.set('tenant_id', tenantId)
          userMsg.set('conversation_id', conv.id)
          userMsg.set('user_id', userId)
          userMsg.set('role', 'user')
          userMsg.set('conteudo', message)
          $app.save(userMsg)
        } catch (err) {
          console.log('[ELLIZA] Erro ao gravar mensagem do usuário:', err)
        }
      }

      const iter = $ai.agent('elliza').chat({
        user_id: userId,
        conversation_id: conv.id,
        message: message,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)

      $response.stream(e, iter)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA ELLIZA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha na requisição ao agente ELLIZA' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'Serviço ELLIZA indisponível' : err.message,
        })
      }
      return e.json(500, { error: err.message || 'Erro interno no chat da ELLIZA' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/elliza/conversations',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const title = (body.title || 'Nova conversa com ELLIZA').trim()
      const tenantId = body.tenant_id

      const conv = $ai.agent('elliza').getOrCreateConversation({
        user_id: userId,
        title: title,
      })

      if (tenantId) {
        try {
          const convCol = $app.findCollectionByNameOrId('agent_conversations')
          let appConv
          try {
            appConv = $app.findFirstRecordByData('agent_conversations', 'id', conv.id)
          } catch (_) {
            appConv = new Record(convCol)
            appConv.set('id', conv.id)
            appConv.set('tenant_id', tenantId)
            appConv.set('user_id', userId)
            appConv.set('titulo', title)
            $app.save(appConv)
          }
        } catch (err) {
          console.log('[ELLIZA] Erro ao registrar conversa:', err)
        }
      }

      return e.json(200, {
        id: conv.id,
        title: conv.title || title,
        created: conv.created,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao criar conversa com ELLIZA' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/elliza/status',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const tenantId = e.requestInfo().query?.tenant_id || ''

      // Verificar status de rotinas e credenciais
      let totalEmpresas = 0
      let totalCertificados = 0
      let totalCertificadosAtivos = 0
      let totalObrigacoesPendentes = 0
      let totalObrigacoesAtrasadas = 0

      try {
        const filterTenant = tenantId ? "tenant_id = '" + tenantId + "'" : ''
        totalEmpresas = $app.findRecordsByFilter('empresas', filterTenant, '', 500, 0).length
        totalCertificados = $app.findRecordsByFilter(
          'certificados_digitais',
          filterTenant,
          '',
          500,
          0,
        ).length
        totalCertificadosAtivos = $app.findRecordsByFilter(
          'certificados_digitais',
          (filterTenant ? filterTenant + ' && ' : '') + "status = 'ativo'",
          '',
          500,
          0,
        ).length
        totalObrigacoesPendentes = $app.findRecordsByFilter(
          'obrigacoes',
          (filterTenant ? filterTenant + ' && ' : '') + "status = 'pendente'",
          '',
          500,
          0,
        ).length
        totalObrigacoesAtrasadas = $app.findRecordsByFilter(
          'obrigacoes',
          (filterTenant ? filterTenant + ' && ' : '') + "status = 'atrasada'",
          '',
          500,
          0,
        ).length
      } catch (errDb) {
        console.log('[ELLIZA] Erro ao consultar estatísticas:', errDb)
      }

      return e.json(200, {
        agente: {
          slug: 'elliza',
          nome: 'ELLIZA',
          versao: '2026.1 (0.0.83)',
          plataforma: 'Rumo Contábil SaaS',
          modo: 'Hiperautomação 24/7 Nativa Skip Cloud',
          padrao_conformidade: 'NBC PP 01 / NBC PG 01 (Modo Assistivo Supervisionado)',
        },
        limites_estabelecidos: {
          rpa_visual: false,
          vm_externa: false,
          desktop_legado_dominio: false,
          infraestrutura_24h: 'Skip Cloud Backend (Collections, APIs, Webhooks e Cron)',
        },
        rotinas_ativas_24_7: [
          {
            id: 'job_obrigacoes_vencimentos',
            nome: 'Varredura de Prazos & Competências',
            frequencia: 'Diária às 08:00 UTC e varredura contínua',
            status: 'ativo_sem_credencial_externa',
            descricao: 'Analisa vencimentos de tributos, parcelamentos e gera alertas automáticos.',
          },
          {
            id: 'job_certificados_a1',
            nome: 'Auditoria Preventiva de Certificados A1',
            frequencia: 'Varredura diária 30d/15d/vencido',
            status: 'ativo_sem_credencial_externa',
            descricao:
              'Monitora a saúde e validade de certificados no cofre e alerta administradores.',
          },
          {
            id: 'job_fechamento_competencias',
            nome: 'Checagem de Consistência do Fecho Mensal',
            frequencia: 'Sob demanda / diária',
            status: 'ativo_sem_credencial_externa',
            descricao: 'Valida checklist contábil de 9 etapas e trava contra edições retroativas.',
          },
          {
            id: 'job_purga_backups',
            nome: 'Retenção e Purga Automática de Backups',
            frequencia: 'A cada 15 minutos',
            status: 'ativo_sem_credencial_externa',
            descricao: 'Garante política de retenção temporária e exclusão segura.',
          },
        ],
        rotinas_aguardando_credenciais: [
          {
            id: 'rotina_ecac_rfb_real',
            nome: 'Transmissão Oficial e-CAC / DTE RFB',
            dependencia: 'Certificado A1 (.pfx) válido + senha no cofre + procuração e-CAC',
            status:
              totalCertificadosAtivos > 0 ? 'apto_para_configuracao' : 'pendente_certificado_a1',
            descricao: 'Captura automática de intimações DTE e validação oficial de CNDs.',
          },
          {
            id: 'rotina_whatsapp_evolution',
            nome: 'Atendimento & Notificações WhatsApp',
            dependencia: 'Instância e API Key Evolution API',
            status: 'pendente_credencial_evolution',
            descricao: 'Envio assistido de avisos de guias, recibos de folha e cobrança.',
          },
          {
            id: 'rotina_cobranca_pix_boleto',
            nome: 'Liquidação & Cobrança Bancária PIX/Boleto',
            dependencia: 'Credenciais de API Bancária (Open Finance / Webhook)',
            status: 'pendente_credencial_bancaria',
            descricao: 'Baixa bancária em tempo real de faturamentos de honorários contábeis.',
          },
        ],
        metricas_tenant: {
          total_empresas: totalEmpresas,
          total_certificados: totalCertificados,
          certificados_ativos: totalCertificadosAtivos,
          obrigacoes_pendentes: totalObrigacoesPendentes,
          obrigacoes_atrasadas: totalObrigacoesAtrasadas,
        },
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao consultar status da ELLIZA' })
    }
  },
  $apis.requireAuth(),
)
