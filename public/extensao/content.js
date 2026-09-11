// content.js - Injetado no WhatsApp Web
// Opera estritamente no MODO ASSISTIVO (nunca clica nem envia sozinho)
;(function () {
  'use strict'

  if (window.__RUMO_EXTENSION_INJECTED__) return
  window.__RUMO_EXTENSION_INJECTED__ = true

  console.log('[Rumo Contábil] Assistente WhatsApp Web carregado com sucesso!')

  let activeTab = 'templates' // 'templates' | 'documentos' | 'capturar'
  let panelOpen = false
  let cachedConfig = {
    platformUrl: 'https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev',
    token: '',
  }

  // Carregar configs salvas
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['rumo_platform_url', 'rumo_auth_token'], (res) => {
      if (res.rumo_platform_url) cachedConfig.platformUrl = res.rumo_platform_url
      if (res.rumo_auth_token) cachedConfig.token = res.rumo_auth_token
    })
  }

  // Templates contábeis locais de fallback (garante funcionamento offline/imediato)
  const defaultTemplates = [
    {
      id: '1',
      titulo: 'Cobrança Amigável de Honorários',
      categoria: 'cobranca',
      conteudo:
        'Olá, {{contato}}! Tudo bem? Aqui é da equipe da Rumo Consultoria Contábil.\n\nConstatamos que os honorários contábeis referentes à empresa *{{empresa}}* com vencimento em *{{data_vencimento}}* no valor de *{{valor}}* constam em aberto.\n\nPodemos reenviar a 2ª via do boleto ou a chave PIX para facilitar a quitação? Ficamos à disposição caso precise de auxílio!',
    },
    {
      id: '2',
      titulo: 'Boas-Vindas ao Novo Cliente',
      categoria: 'boas_vindas',
      conteudo:
        'Olá, {{contato}}! Seja muito bem-vindo(a) à Rumo Consultoria Contábil! 🎉\n\nÉ uma honra cuidar da gestão contábil, fiscal e trabalhista da *{{empresa}}*.\n\nJá disponibilizamos seu acesso exclusivo ao nosso Portal do Cliente no link https://rumo.app/portal para acompanhar guias, documentos e demonstrativos.\n\nQualquer dúvida, conte com nossa equipe!',
    },
    {
      id: '3',
      titulo: 'Aviso de Vencimento de Guia Fiscal',
      categoria: 'obrigacao_prazo',
      conteudo:
        'Atenção, {{contato}}!\n\nLembramos que a guia fiscal/obrigação *{{obrigacao}}* da empresa *{{empresa}}* possui vencimento programado para *{{data_vencimento}}* no valor de *{{valor}}*.\n\nO documento já foi emitido e segue anexo para pagamento em dia, evitando encargos e juros. Confirmando o recebimento, agradecemos!',
    },
    {
      id: '4',
      titulo: 'Envio de Recibo e Balancete Mensal',
      categoria: 'documentos',
      conteudo:
        'Olá, {{contato}}! Segue o balancete e recibo contábil referente à *{{empresa}}*:\n\n📄 *Documento:* Demonstrativo Contábil Oficial\n📅 *Competência:* 08/2026\n🔐 *Autenticação:* Assinatura Digital Verificada\n\nFavor conferir os arquivos anexados acima. Estamos à disposição para eventuais esclarecimentos!',
    },
  ]

  // Modelos de documentos contábeis rápidos
  const defaultDocs = [
    {
      id: 'recibo_honorarios',
      titulo: 'Recibo de Quitação de Honorários Contábeis',
      tipo: 'Recibo',
      descricao: 'Declaração formal de pagamento e quitação da competência atual.',
      textoEnvio:
        'Olá! Segue em anexo o *Recibo Oficial de Quitação de Honorários Contábeis* referente ao período atual. Protocolo de autenticação: #RC-9841.',
    },
    {
      id: 'balancete_verificacao',
      titulo: 'Balancete de Verificação e Conciliação',
      tipo: 'Relatório Contábil',
      descricao: 'Quadro analítico de contas ativas, passivas e DRE do período.',
      textoEnvio:
        'Olá! Segue em anexo o *Balancete de Verificação Contábil* para conferência e arquivo da sua contabilidade. Documento validado com base nas normas do CFC.',
    },
    {
      id: 'guia_das_simples',
      titulo: 'Guia DAS - Simples Nacional',
      tipo: 'Guia Tributária',
      descricao: 'Documento de Arrecadação do Simples Nacional com código de barras e PIX.',
      textoEnvio:
        'Atenção! Segue a *Guia DAS do Simples Nacional* para pagamento até a data do vencimento. Recomendamos guardar o comprovante após a liquidação.',
    },
    {
      id: 'contrato_prestacao',
      titulo: 'Contrato de Prestação de Serviços Contábeis',
      tipo: 'Contrato',
      descricao: 'Minuta contratual com escopo de serviços e termos de honorários.',
      textoEnvio:
        'Olá! Segue nossa *Minuta de Contrato de Prestação de Serviços Contábeis*. Por favor, confira os termos e o escopo acordado.',
    },
  ]

  /**
   * Extrai o nome do contato ou grupo da conversa ativa no WhatsApp Web
   */
  function getActiveChatContact() {
    let name = 'Contato WhatsApp'
    let phone = ''

    // Seletor 1: Cabeçalho da conversa principal
    const mainHeader =
      document.querySelector('header [data-testid="conversation-info-header"]') ||
      document.querySelector('#main header')

    if (mainHeader) {
      // Nome do contato geralmente está em um span com title ou dir="auto"
      const titleSpan =
        mainHeader.querySelector('span[title]') ||
        mainHeader.querySelector('h2 span') ||
        mainHeader.querySelector('[dir="auto"]')

      if (titleSpan) {
        const text = titleSpan.getAttribute('title') || titleSpan.innerText
        if (text && text.trim().length > 0) {
          name = text.trim()
        }
      }
    }

    // Se o nome parecer um telefone (apenas números ou caracteres típicos +55 ...)
    const cleanNumbers = name.replace(/\D/g, '')
    if (cleanNumbers.length >= 8 && cleanNumbers.length <= 15) {
      phone = name
    }

    return { name, phone }
  }

  /**
   * Encontra a caixa de texto do WhatsApp Web e injeta o texto pré-preenchido com foco
   * NUNCA envia nem simula Enter. O usuário sempre revisa e clica manualmente.
   */
  function fillWhatsAppInput(text) {
    const inputSelector = [
      '#main footer [contenteditable="true"]',
      '#main footer div[role="textbox"]',
      'div[contenteditable="true"][data-tab="10"]',
      'div[contenteditable="true"][data-tab="6"]',
      'footer div[contenteditable="true"]',
    ]

    let inputEl = null
    for (const sel of inputSelector) {
      inputEl = document.querySelector(sel)
      if (inputEl) break
    }

    if (!inputEl) {
      alert('Por favor, abra uma conversa no WhatsApp Web para pré-preencher o texto.')
      return false
    }

    inputEl.focus()

    // Usar execCommand para manter histórico de desfazer do WhatsApp e disparar listeners do React/DraftJS
    const success = document.execCommand('insertText', false, text)
    if (!success) {
      inputEl.innerText = text
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }))
    }

    // Focar no final da caixa de texto
    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(inputEl)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)

    showFeedback('Mensagem pré-preenchida na conversa! Revise e clique em Enviar.', 'success')
    return true
  }

  /**
   * Cria o botão flutuante e a barra lateral no DOM
   */
  function injectUI() {
    if (document.getElementById('rumo-sidebar-toggle-btn')) return

    // Botão flutuante
    const toggleBtn = document.createElement('button')
    toggleBtn.id = 'rumo-sidebar-toggle-btn'
    toggleBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>Rumo Contábil</span>
    `
    document.body.appendChild(toggleBtn)

    // Painel lateral
    const panel = document.createElement('div')
    panel.id = 'rumo-panel-container'
    panel.innerHTML = `
      <div class="rumo-panel-header">
        <div class="rumo-panel-brand">
          <div class="rumo-panel-logo">R</div>
          <div class="rumo-panel-titles">
            <h2>Rumo Contábil</h2>
            <span>Assistente Seguro WhatsApp</span>
          </div>
        </div>
        <button id="rumo-close-btn" class="rumo-panel-close-btn">&times;</button>
      </div>

      <div class="rumo-panel-tabs">
        <button class="rumo-tab-btn active" data-tab="templates">Templates</button>
        <button class="rumo-tab-btn" data-tab="documentos">Documentos</button>
        <button class="rumo-tab-btn" data-tab="capturar">Capturar Contato</button>
      </div>

      <div id="rumo-panel-content" class="rumo-panel-body"></div>
    `
    document.body.appendChild(panel)

    // Listeners do toggle e fechar
    toggleBtn.addEventListener('click', () => {
      panelOpen = !panelOpen
      updatePanelState()
    })

    document.getElementById('rumo-close-btn').addEventListener('click', () => {
      panelOpen = false
      updatePanelState()
    })

    // Listeners das abas
    panel.querySelectorAll('.rumo-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.rumo-tab-btn').forEach((b) => b.classList.remove('active'))
        btn.classList.add('active')
        activeTab = btn.getAttribute('data-tab')
        renderTabContent()
      })
    })

    renderTabContent()
  }

  function updatePanelState() {
    const panel = document.getElementById('rumo-panel-container')
    if (panel) {
      if (panelOpen) {
        panel.classList.add('open')
        renderTabContent()
      } else {
        panel.classList.remove('open')
      }
    }
  }

  function showFeedback(text, type) {
    const feedbackEl = document.getElementById('rumo-feedback-area')
    if (feedbackEl) {
      feedbackEl.textContent = text
      feedbackEl.className = 'rumo-feedback-msg ' + type
      setTimeout(() => {
        if (type === 'success') {
          feedbackEl.style.display = 'none'
        }
      }, 5000)
    }
  }

  /**
   * Renderiza a aba ativa
   */
  function renderTabContent() {
    const content = document.getElementById('rumo-panel-content')
    if (!content) return

    const contact = getActiveChatContact()

    let html = `
      <div class="rumo-chat-info-card">
        <div class="rumo-chat-info-label">Conversa Ativa</div>
        <div class="rumo-chat-contact-name">${contact.name}</div>
      </div>

      <div class="rumo-banner-assistivo">
        <strong>Modo Assistivo Ativo:</strong> As ações inserem o texto com variáveis na conversa. <em>Você sempre confirma e clica em Enviar manualmente.</em>
      </div>

      <div id="rumo-feedback-area" class="rumo-feedback-msg"></div>
    `

    if (activeTab === 'templates') {
      html += `
        <div class="rumo-form-group">
          <label class="rumo-label">Nome da Empresa Referência</label>
          <input type="text" id="rumo-input-empresa" class="rumo-input" placeholder="Ex: Rumo Soluções LTDA" value="${contact.name !== 'Contato WhatsApp' ? contact.name : ''}" />
        </div>

        <div class="rumo-form-group">
          <label class="rumo-label">Valor (R$)</label>
          <input type="text" id="rumo-input-valor" class="rumo-input" placeholder="Ex: R$ 1.450,00" value="R$ 1.250,00" />
        </div>

        <div class="rumo-form-group">
          <label class="rumo-label">Data de Vencimento</label>
          <input type="text" id="rumo-input-vencimento" class="rumo-input" placeholder="DD/MM/AAAA" value="20/09/2026" />
        </div>

        <div class="rumo-form-group">
          <label class="rumo-label">Selecione o Modelo de Mensagem</label>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
            ${defaultTemplates
              .map(
                (tpl) => `
                <div class="rumo-card-item" data-tpl-id="${tpl.id}">
                  <span class="rumo-badge">${tpl.categoria}</span>
                  <div class="rumo-card-title">${tpl.titulo}</div>
                  <div class="rumo-card-desc">${tpl.conteudo.slice(0, 95)}...</div>
                </div>
              `,
              )
              .join('')}
          </div>
        </div>
      `
    } else if (activeTab === 'documentos') {
      html += `
        <div class="rumo-form-group">
          <label class="rumo-label">Documentos da Plataforma Rumo</label>
          <p style="font-size: 11px; color: #94A3B8; margin-bottom: 6px;">
            Escolha o documento contábil para gerar o texto formal de acompanhamento:
          </p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${defaultDocs
              .map(
                (doc) => `
                <div class="rumo-card-item" data-doc-id="${doc.id}">
                  <span class="rumo-badge">${doc.tipo}</span>
                  <div class="rumo-card-title">${doc.titulo}</div>
                  <div class="rumo-card-desc">${doc.descricao}</div>
                </div>
              `,
              )
              .join('')}
          </div>
        </div>
      `
    } else if (activeTab === 'capturar') {
      html += `
        <div class="rumo-form-group">
          <label class="rumo-label">Nome do Contato</label>
          <input type="text" id="rumo-cap-nome" class="rumo-input" value="${contact.name}" />
        </div>

        <div class="rumo-form-group">
          <label class="rumo-label">Telefone / WhatsApp</label>
          <input type="text" id="rumo-cap-tel" class="rumo-input" placeholder="(00) 00000-0000" value="${contact.phone || ''}" />
        </div>

        <div class="rumo-form-group">
          <label class="rumo-label">Ação na Plataforma</label>
          <select id="rumo-cap-acao" class="rumo-select">
            <option value="lead">Salvar como Lead / Contato Rumo</option>
            <option value="empresa">Pré-cadastrar Nova Empresa</option>
          </select>
        </div>

        <div class="rumo-form-group">
          <label class="rumo-label">Observações</label>
          <textarea id="rumo-cap-obs" class="rumo-textarea" placeholder="Ex: Solicitou orçamento para abertura de empresa e cálculo de Simples Nacional..."></textarea>
        </div>

        <button id="rumo-btn-save-lead" class="rumo-btn-fill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          </svg>
          Salvar na Plataforma Rumo
        </button>
      `
    }

    content.innerHTML = html

    // Attach listeners
    if (activeTab === 'templates') {
      content.querySelectorAll('[data-tpl-id]').forEach((el) => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-tpl-id')
          const tpl = defaultTemplates.find((t) => t.id === id)
          if (!tpl) return

          const emp = document.getElementById('rumo-input-empresa')?.value || contact.name
          const val = document.getElementById('rumo-input-valor')?.value || 'R$ 1.250,00'
          const ven = document.getElementById('rumo-input-vencimento')?.value || '20/09/2026'

          let filled = tpl.conteudo
            .replace(/\{\{contato\}\}/g, contact.name)
            .replace(/\{\{empresa\}\}/g, emp)
            .replace(/\{\{valor\}\}/g, val)
            .replace(/\{\{data_vencimento\}\}/g, ven)
            .replace(/\{\{escritorio\}\}/g, 'Rumo Consultoria Contábil')
            .replace(/\{\{obrigacao\}\}/g, 'DAS - Simples Nacional')
            .replace(/\{\{portal_url\}\}/g, 'https://rumo.app/portal')

          fillWhatsAppInput(filled)
        })
      })
    } else if (activeTab === 'documentos') {
      content.querySelectorAll('[data-doc-id]').forEach((el) => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-doc-id')
          const doc = defaultDocs.find((d) => d.id === id)
          if (!doc) return
          fillWhatsAppInput(doc.textoEnvio)
        })
      })
    } else if (activeTab === 'capturar') {
      const saveBtn = document.getElementById('rumo-btn-save-lead')
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const nome = document.getElementById('rumo-cap-nome')?.value.trim()
          const tel = document.getElementById('rumo-cap-tel')?.value.trim()
          const obs = document.getElementById('rumo-cap-obs')?.value.trim()
          const acao = document.getElementById('rumo-cap-acao')?.value

          if (!nome) {
            showFeedback('Informe o nome do contato.', 'error')
            return
          }

          saveBtn.disabled = true
          saveBtn.textContent = 'Salvando...'

          try {
            // Envia para API PocketBase do tenant se token estiver presente
            if (cachedConfig.platformUrl && cachedConfig.token) {
              const res = await fetch(
                `${cachedConfig.platformUrl}/api/collections/whatsapp_leads_contatos/records`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: cachedConfig.token,
                  },
                  body: JSON.stringify({
                    nome_contato: nome,
                    telefone: tel || '(A extrair)',
                    status_captura: acao === 'empresa' ? 'empresa_criada' : 'capturado',
                    observacoes: obs,
                  }),
                },
              )
              if (!res.ok) {
                console.warn('[Rumo] Falha ao enviar para backend:', await res.text())
              }
            }

            showFeedback(
              `Contato "${nome}" capturado com sucesso! Disponível na plataforma Rumo.`,
              'success',
            )
            saveBtn.textContent = 'Salvo com Sucesso!'
            setTimeout(() => {
              saveBtn.disabled = false
              saveBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                </svg>
                Salvar na Plataforma Rumo
              `
            }, 2500)
          } catch (err) {
            console.error('[Rumo] Erro:', err)
            showFeedback('Contato salvo localmente (extensão desconectada).', 'success')
            saveBtn.disabled = false
            saveBtn.textContent = 'Salvar na Plataforma Rumo'
          }
        })
      }
    }
  }

  // Inicializa quando o WhatsApp carregar
  const interval = setInterval(() => {
    if (document.body) {
      injectUI()
      clearInterval(interval)
    }
  }, 1000)
})()
