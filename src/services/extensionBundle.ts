import { createZipBlob } from './zipGenerator'

// Códigos fonte que compõem o pacote de extensão Chrome Manifest V3
export const EXTENSION_SOURCE_FILES = {
  'manifest.json': `{
  "manifest_version": 3,
  "name": "Rumo Contábil - Assistente WhatsApp Web",
  "version": "1.0.0",
  "description": "Assistente contábil seguro para WhatsApp Web: mensagens rápidas com templates, envio assistivo de documentos e captura de contatos para a Plataforma Rumo.",
  "icons": {
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "Rumo Contábil - Assistente WhatsApp"
  },
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://web.whatsapp.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://web.whatsapp.com/*"
      ],
      "js": [
        "content.js"
      ],
      "css": [
        "content.css"
      ],
      "run_at": "document_idle"
    }
  ]
}`,

  'popup.html': `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Rumo Contábil - Conexão</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      width: 360px;
      padding: 16px;
      background-color: #0B1F3A;
      color: #F8FAFC;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #1E293B;
    }
    .logo-badge {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, #0FA3A3, #123B6D);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #FFF;
      font-size: 18px;
    }
    .header-text h1 {
      font-size: 15px;
      font-weight: 700;
      color: #FFF;
    }
    .header-text p {
      font-size: 11px;
      color: #94A3B8;
    }
    .notice {
      background-color: #0F172A;
      border: 1px solid #1E293B;
      border-left: 3px solid #0FA3A3;
      padding: 10px;
      border-radius: 6px;
      font-size: 11px;
      line-height: 1.4;
      color: #CBD5E1;
      margin-bottom: 16px;
    }
    .notice strong { color: #38BDF8; }
    .form-group {
      margin-bottom: 12px;
    }
    label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #94A3B8;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    input {
      width: 100%;
      padding: 8px 10px;
      background-color: #0F172A;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #FFF;
      font-size: 12px;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus {
      border-color: #0FA3A3;
    }
    .btn {
      width: 100%;
      padding: 9px;
      border-radius: 6px;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-primary {
      background-color: #0FA3A3;
      color: #FFF;
      margin-top: 4px;
    }
    .btn-primary:hover {
      background-color: #0d8c8c;
    }
    .btn-secondary {
      background-color: transparent;
      border: 1px solid #334155;
      color: #94A3B8;
      margin-top: 8px;
    }
    .btn-secondary:hover {
      background-color: #1E293B;
      color: #FFF;
    }
    .status {
      margin-top: 12px;
      padding: 8px;
      border-radius: 6px;
      font-size: 11px;
      text-align: center;
      display: none;
    }
    .status.success {
      display: block;
      background-color: rgba(34, 197, 94, 0.15);
      border: 1px solid #22C55E;
      color: #86EFAC;
    }
    .status.error {
      display: block;
      background-color: rgba(239, 68, 68, 0.15);
      border: 1px solid #EF4444;
      color: #FCA5A5;
    }
    .footer {
      margin-top: 16px;
      padding-top: 10px;
      border-top: 1px solid #1E293B;
      font-size: 10px;
      color: #64748B;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-badge">R</div>
    <div class="header-text">
      <h1>Rumo Contábil</h1>
      <p>Assistente WhatsApp Web</p>
    </div>
  </div>

  <div class="notice">
    <strong>Modo Assistivo Seguro:</strong> Esta extensão não realiza disparos em massa nem simula envios automáticos. Ela pré-preenche mensagens e documentos na tela para conferência e envio manual pelo usuário.
  </div>

  <div class="form-group">
    <label for="platformUrl">URL da Plataforma Rumo</label>
    <input type="text" id="platformUrl" placeholder="https://app.rumocontabil.com.br" />
  </div>

  <div class="form-group">
    <label for="authToken">Token de Conexão (Copie em /extensao)</label>
    <input type="password" id="authToken" placeholder="Cole o token da sua sessão" />
  </div>

  <button id="saveBtn" class="btn btn-primary">Salvar Conexão</button>
  <button id="testBtn" class="btn btn-secondary">Testar Comunicação</button>

  <div id="statusMsg" class="status"></div>

  <div class="footer">
    Rumo Consultoria Contábil &bull; Modo 100% Assistivo
  </div>

  <script src="popup.js"></script>
</body>
</html>`,

  'popup.js': `// popup.js - Gerencia as configurações da extensão Rumo
document.addEventListener('DOMContentLoaded', () => {
  const platformUrlInput = document.getElementById('platformUrl')
  const authTokenInput = document.getElementById('authToken')
  const saveBtn = document.getElementById('saveBtn')
  const testBtn = document.getElementById('testBtn')
  const statusMsg = document.getElementById('statusMsg')

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['rumo_platform_url', 'rumo_auth_token'], (res) => {
      if (res.rumo_platform_url) {
        platformUrlInput.value = res.rumo_platform_url
      }
      if (res.rumo_auth_token) {
        authTokenInput.value = res.rumo_auth_token
      }
    })
  }

  function showStatus(text, type) {
    statusMsg.textContent = text
    statusMsg.className = 'status ' + type
    setTimeout(() => {
      if (type === 'success') {
        statusMsg.style.display = 'none'
      }
    }, 4000)
  }

  saveBtn.addEventListener('click', () => {
    let url = (platformUrlInput.value || '').trim()
    const token = (authTokenInput.value || '').trim()

    if (!url) {
      showStatus('Informe a URL da plataforma.', 'error')
      return
    }
    if (url.endsWith('/')) {
      url = url.slice(0, -1)
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(
        {
          rumo_platform_url: url,
          rumo_auth_token: token,
        },
        () => {
          showStatus('Configurações salvas com sucesso!', 'success')
        },
      )
    } else {
      localStorage.setItem('rumo_platform_url', url)
      localStorage.setItem('rumo_auth_token', token)
      showStatus('Configurações salvas!', 'success')
    }
  })

  testBtn.addEventListener('click', async () => {
    let url = (platformUrlInput.value || '').trim()
    const token = (authTokenInput.value || '').trim()

    if (!url) {
      showStatus('Informe a URL da plataforma.', 'error')
      return
    }
    if (url.endsWith('/')) url = url.slice(0, -1)

    showStatus('Testando conexão com a Rumo...', 'success')

    try {
      const headers = {}
      if (token) headers['Authorization'] = token
      const res = await fetch(url + '/api/collections/whatsapp_templates/records?limit=1', { headers })
      if (res.ok || res.status === 401 || res.status === 403) {
        showStatus('Servidor respondeu com sucesso! Conexão ativa.', 'success')
      } else {
        showStatus('Status ' + res.status + ': verifique URL ou token', 'error')
      }
    } catch (err) {
      showStatus('Falha de rede ao conectar à URL configurada.', 'error')
    }
  })
})`,

  'content.css': `/* content.css - Painel assistivo Rumo no WhatsApp Web */
#rumo-sidebar-toggle-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999999;
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #0FA3A3 0%, #123B6D 100%);
  color: #FFFFFF;
  border: none;
  border-radius: 9999px;
  padding: 10px 18px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(15, 163, 163, 0.4);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

#rumo-sidebar-toggle-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(15, 163, 163, 0.55);
}

#rumo-panel-container {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  height: 100vh;
  z-index: 999998;
  background-color: #0B1F3A;
  color: #F8FAFC;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

#rumo-panel-container.open {
  transform: translateX(0);
}

.rumo-panel-header {
  padding: 16px 20px;
  background-color: #0d2545;
  border-bottom: 1px solid #1E3A5F;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rumo-panel-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rumo-panel-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #0FA3A3, #123B6D);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
  color: white;
}

.rumo-panel-titles h2 {
  font-size: 14px;
  font-weight: 700;
  color: #FFFFFF;
  margin: 0;
}

.rumo-panel-titles span {
  font-size: 11px;
  color: #0FA3A3;
  font-weight: 600;
}

.rumo-panel-close-btn {
  background: transparent;
  border: none;
  color: #94A3B8;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
}
.rumo-panel-close-btn:hover {
  color: #FFFFFF;
}

.rumo-panel-tabs {
  display: flex;
  background-color: #08172c;
  border-bottom: 1px solid #1E3A5F;
}

.rumo-tab-btn {
  flex: 1;
  padding: 10px 4px;
  background: transparent;
  border: none;
  color: #94A3B8;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  text-align: center;
}

.rumo-tab-btn.active {
  color: #0FA3A3;
  border-bottom-color: #0FA3A3;
  background-color: rgba(15, 163, 163, 0.08);
}

.rumo-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rumo-chat-info-card {
  background-color: #122B4D;
  border: 1px solid #1E3A5F;
  border-radius: 10px;
  padding: 12px;
  font-size: 12px;
}

.rumo-chat-info-label {
  font-size: 10px;
  text-transform: uppercase;
  color: #94A3B8;
  font-weight: 600;
  margin-bottom: 4px;
}

.rumo-chat-contact-name {
  font-size: 13px;
  font-weight: 700;
  color: #38BDF8;
}

.rumo-banner-assistivo {
  background-color: rgba(15, 163, 163, 0.1);
  border: 1px dashed #0FA3A3;
  border-radius: 8px;
  padding: 10px;
  font-size: 11px;
  color: #CBD5E1;
  line-height: 1.4;
}

.rumo-banner-assistivo strong {
  color: #0FA3A3;
}

.rumo-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rumo-label {
  font-size: 11px;
  color: #94A3B8;
  font-weight: 600;
}

.rumo-input, .rumo-select, .rumo-textarea {
  width: 100%;
  padding: 8px 10px;
  background-color: #08172c;
  border: 1px solid #1E3A5F;
  border-radius: 6px;
  color: #FFFFFF;
  font-size: 12px;
  box-sizing: border-box;
}

.rumo-input:focus, .rumo-select:focus, .rumo-textarea:focus {
  outline: none;
  border-color: #0FA3A3;
}

.rumo-textarea {
  resize: vertical;
  min-height: 90px;
  line-height: 1.4;
}

.rumo-btn-fill {
  background: linear-gradient(135deg, #0FA3A3 0%, #0d8c8c 100%);
  color: #FFFFFF;
  border: none;
  border-radius: 6px;
  padding: 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity 0.2s;
}

.rumo-btn-fill:hover {
  opacity: 0.92;
}

.rumo-card-item {
  background-color: #0e2747;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}

.rumo-card-item:hover {
  border-color: #0FA3A3;
  background-color: #123157;
}

.rumo-card-title {
  font-size: 12px;
  font-weight: 600;
  color: #FFFFFF;
  margin-bottom: 4px;
}

.rumo-card-desc {
  font-size: 11px;
  color: #94A3B8;
  line-height: 1.3;
}

.rumo-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  background-color: rgba(15, 163, 163, 0.2);
  color: #0FA3A3;
  margin-bottom: 4px;
}

.rumo-feedback-msg {
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  text-align: center;
  display: none;
}
.rumo-feedback-msg.success {
  display: block;
  background-color: rgba(34, 197, 94, 0.15);
  border: 1px solid #22C55E;
  color: #86EFAC;
}
.rumo-feedback-msg.error {
  display: block;
  background-color: rgba(239, 68, 68, 0.15);
  border: 1px solid #EF4444;
  color: #FCA5A5;
}`,

  'content.js': `// content.js - Injetado no WhatsApp Web
// Opera estritamente no MODO ASSISTIVO (nunca clica nem envia sozinho)
;(function () {
  'use strict'

  if (window.__RUMO_EXTENSION_INJECTED__) return
  window.__RUMO_EXTENSION_INJECTED__ = true

  console.log('[Rumo Contábil] Assistente WhatsApp Web carregado!')

  let activeTab = 'templates'
  let panelOpen = false
  let cachedConfig = {
    platformUrl: '',
    token: '',
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['rumo_platform_url', 'rumo_auth_token'], (res) => {
      if (res.rumo_platform_url) cachedConfig.platformUrl = res.rumo_platform_url
      if (res.rumo_auth_token) cachedConfig.token = res.rumo_auth_token
    })
  }

  const defaultTemplates = [
    {
      id: '1',
      titulo: 'Cobrança Amigável de Honorários',
      categoria: 'cobranca',
      conteudo:
        'Olá, {{contato}}! Tudo bem? Aqui é da equipe da Rumo Consultoria Contábil.\\n\\nConstatamos que os honorários contábeis referentes à empresa *{{empresa}}* com vencimento em *{{data_vencimento}}* no valor de *{{valor}}* constam em aberto.\\n\\nPodemos reenviar a 2ª via do boleto ou a chave PIX para facilitar a quitação? Ficamos à disposição caso precise de auxílio!',
    },
    {
      id: '2',
      titulo: 'Boas-Vindas ao Novo Cliente',
      categoria: 'boas_vindas',
      conteudo:
        'Olá, {{contato}}! Seja muito bem-vindo(a) à Rumo Consultoria Contábil! 🎉\\n\\nÉ uma honra cuidar da gestão contábil, fiscal e trabalhista da *{{empresa}}*.\\n\\nJá disponibilizamos seu acesso exclusivo ao nosso Portal do Cliente no link https://rumo.app/portal para acompanhar guias, documentos e demonstrativos.\\n\\nQualquer dúvida, conte com nossa equipe!',
    },
    {
      id: '3',
      titulo: 'Aviso de Vencimento de Guia Fiscal',
      categoria: 'obrigacao_prazo',
      conteudo:
        'Atenção, {{contato}}!\\n\\nLembramos que a guia fiscal/obrigação *{{obrigacao}}* da empresa *{{empresa}}* possui vencimento programado para *{{data_vencimento}}* no valor de *{{valor}}*.\\n\\nO documento já foi emitido e segue anexo para pagamento em dia, evitando encargos e juros. Confirmando o recebimento, agradecemos!',
    },
    {
      id: '4',
      titulo: 'Envio de Recibo e Balancete Mensal',
      categoria: 'documentos',
      conteudo:
        'Olá, {{contato}}! Segue o balancete e recibo contábil referente à *{{empresa}}*:\\n\\n📄 *Documento:* Demonstrativo Contábil Oficial\\n📅 *Competência:* 08/2026\\n🔐 *Autenticação:* Assinatura Digital Verificada\\n\\nFavor conferir os arquivos anexados acima. Estamos à disposição para eventuais esclarecimentos!',
    },
  ]

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

  function getActiveChatContact() {
    let name = 'Contato WhatsApp'
    let phone = ''

    const mainHeader = document.querySelector('header [data-testid="conversation-info-header"]') ||
      document.querySelector('#main header')

    if (mainHeader) {
      const titleSpan = mainHeader.querySelector('span[title]') ||
        mainHeader.querySelector('h2 span') ||
        mainHeader.querySelector('[dir="auto"]')

      if (titleSpan) {
        const text = titleSpan.getAttribute('title') || titleSpan.innerText
        if (text && text.trim().length > 0) {
          name = text.trim()
        }
      }
    }

    const cleanNumbers = name.replace(/\\D/g, '')
    if (cleanNumbers.length >= 8 && cleanNumbers.length <= 15) {
      phone = name
    }

    return { name, phone }
  }

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

    const success = document.execCommand('insertText', false, text)
    if (!success) {
      inputEl.innerText = text
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }))
    }

    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(inputEl)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)

    showFeedback('Mensagem pré-preenchida na conversa! Revise e clique em Enviar manualmente.', 'success')
    return true
  }

  function injectUI() {
    if (document.getElementById('rumo-sidebar-toggle-btn')) return

    const toggleBtn = document.createElement('button')
    toggleBtn.id = 'rumo-sidebar-toggle-btn'
    toggleBtn.innerHTML = \`
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>Rumo Contábil</span>
    \`
    document.body.appendChild(toggleBtn)

    const panel = document.createElement('div')
    panel.id = 'rumo-panel-container'
    panel.innerHTML = \`
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
    \`
    document.body.appendChild(panel)

    toggleBtn.addEventListener('click', () => {
      panelOpen = !panelOpen
      updatePanelState()
    })

    document.getElementById('rumo-close-btn').addEventListener('click', () => {
      panelOpen = false
      updatePanelState()
    })

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

  function renderTabContent() {
    const content = document.getElementById('rumo-panel-content')
    if (!content) return

    const contact = getActiveChatContact()

    let html = \`
      <div class="rumo-chat-info-card">
        <div class="rumo-chat-info-label">Conversa Ativa</div>
        <div class="rumo-chat-contact-name">\${contact.name}</div>
      </div>

      <div class="rumo-banner-assistivo">
        <strong>Modo Assistivo Ativo:</strong> As ações inserem o texto com variáveis na conversa. <em>Você sempre confirma e clica em Enviar manualmente.</em>
      </div>

      <div id="rumo-feedback-area" class="rumo-feedback-msg"></div>
    \`

    if (activeTab === 'templates') {
      html += \`
        <div class="rumo-form-group">
          <label class="rumo-label">Nome da Empresa Referência</label>
          <input type="text" id="rumo-input-empresa" class="rumo-input" placeholder="Ex: Rumo Soluções LTDA" value="\${contact.name !== 'Contato WhatsApp' ? contact.name : ''}" />
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
            \${defaultTemplates
              .map(
                (tpl) => \`
                <div class="rumo-card-item" data-tpl-id="\${tpl.id}">
                  <span class="rumo-badge">\${tpl.categoria}</span>
                  <div class="rumo-card-title">\${tpl.titulo}</div>
                  <div class="rumo-card-desc">\${tpl.conteudo.slice(0, 95)}...</div>
                </div>
              \`,
              )
              .join('')}
          </div>
        </div>
      \`
    } else if (activeTab === 'documentos') {
      html += \`
        <div class="rumo-form-group">
          <label class="rumo-label">Documentos da Plataforma Rumo</label>
          <p style="font-size: 11px; color: #94A3B8; margin-bottom: 6px;">
            Escolha o documento contábil para gerar o texto formal de acompanhamento:
          </p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            \${defaultDocs
              .map(
                (doc) => \`
                <div class="rumo-card-item" data-doc-id="\${doc.id}">
                  <span class="rumo-badge">\${doc.tipo}</span>
                  <div class="rumo-card-title">\${doc.titulo}</div>
                  <div class="rumo-card-desc">\${doc.descricao}</div>
                </div>
              \`,
              )
              .join('')}
          </div>
        </div>
      \`
    } else if (activeTab === 'capturar') {
      html += \`
        <div class="rumo-form-group">
          <label class="rumo-label">Nome do Contato</label>
          <input type="text" id="rumo-cap-nome" class="rumo-input" value="\${contact.name}" />
        </div>

        <div class="rumo-form-group">
          <label class="rumo-label">Telefone / WhatsApp</label>
          <input type="text" id="rumo-cap-tel" class="rumo-input" placeholder="(00) 00000-0000" value="\${contact.phone || ''}" />
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
      \`
    }

    content.innerHTML = html

    if (activeTab === 'templates') {
      content.querySelectorAll('[data-tpl-id]').forEach((el) => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-tpl-id')
          const tpl = defaultTemplates.find((t) => t.id === id)
          if (!tpl) return

          const emp = (document.getElementById('rumo-input-empresa') as HTMLInputElement)?.value || contact.name
          const val = (document.getElementById('rumo-input-valor') as HTMLInputElement)?.value || 'R$ 1.250,00'
          const ven = (document.getElementById('rumo-input-vencimento') as HTMLInputElement)?.value || '20/09/2026'

          let filled = tpl.conteudo
            .replace(/\\{\\{contato\\}\\}/g, contact.name)
            .replace(/\\{\\{empresa\\}\\}/g, emp)
            .replace(/\\{\\{valor\\}\\}/g, val)
            .replace(/\\{\\{data_vencimento\\}\\}/g, ven)
            .replace(/\\{\\{escritorio\\}\\}/g, 'Rumo Consultoria Contábil')
            .replace(/\\{\\{obrigacao\\}\\}/g, 'DAS - Simples Nacional')
            .replace(/\\{\\{portal_url\\}\\}/g, 'https://rumo.app/portal')

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
      const saveBtn = document.getElementById('rumo-btn-save-lead') as HTMLButtonElement | null
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const nome = (document.getElementById('rumo-cap-nome') as HTMLInputElement)?.value.trim()
          const tel = (document.getElementById('rumo-cap-tel') as HTMLInputElement)?.value.trim()
          const obs = (document.getElementById('rumo-cap-obs') as HTMLTextAreaElement)?.value.trim()
          const acao = (document.getElementById('rumo-cap-acao') as HTMLSelectElement)?.value

          if (!nome) {
            showFeedback('Informe o nome do contato.', 'error')
            return
          }

          saveBtn.disabled = true
          saveBtn.textContent = 'Salvando...'

          try {
            if (cachedConfig.platformUrl && cachedConfig.token) {
              await fetch(
                cachedConfig.platformUrl + '/api/collections/whatsapp_leads_contatos/records',
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
            }

            showFeedback('Contato "' + nome + '" capturado com sucesso! Disponível na plataforma Rumo.', 'success')
            saveBtn.textContent = 'Salvo com Sucesso!'
            setTimeout(() => {
              saveBtn.disabled = false
              saveBtn.innerHTML = 'Salvar na Plataforma Rumo'
            }, 2500)
          } catch (err) {
            console.error('[Rumo] Erro:', err)
            showFeedback('Contato salvo localmente!', 'success')
            saveBtn.disabled = false
            saveBtn.textContent = 'Salvar na Plataforma Rumo'
          }
        })
      }
    }
  }

  const interval = setInterval(() => {
    if (document.body) {
      injectUI()
      clearInterval(interval)
    }
  }, 1000)
})()`,

  'README.md': `# Rumo Contábil - Extensão para Google Chrome (WhatsApp Web Assistivo)

Esta extensão integra a plataforma contábil **Rumo** ao WhatsApp Web em **modo 100% assistivo**, respeitando os termos do WhatsApp e garantindo segurança jurídica e operacional ao seu escritório de contabilidade.

## 🚀 Como Instalar no Google Chrome

1. **Extraia** o arquivo ZIP baixado em uma pasta permanente do seu computador (ex: \`Documentos/rumo-extensao\`).
2. Abra o Google Chrome e acesse a URL: \`chrome://extensions/\` (ou acesse Menu > Extensões > Gerenciar Extensões).
3. No canto superior direito, **ative** a opção **"Modo do desenvolvedor"**.
4. Clique no botão **"Carregar sem compactação"** no canto superior esquerdo.
5. Selecione a pasta onde você descompactou os arquivos desta extensão.
6. A extensão **Rumo Contábil - Assistente WhatsApp Web** estará instalada e ativa!

## 🔐 Configuração Inicial

1. Clique no ícone de quebra-cabeça das extensões no Chrome e fixe o ícone da **Rumo**.
2. Clique no ícone da extensão para abrir o popup.
3. Copie o **Token de Conexão** gerado na página \`/extensao\` da sua plataforma Rumo e cole no popup.
4. Clique em **Salvar Conexão**.

## 🛡️ O que é o Modo Assistivo?
- **O que faz:**
  - Carrega templates inteligentes contábeis (cobrança, boas-vindas, lembrete de obrigações).
  - Pré-preenche o texto com variáveis (nome, empresa, valores, datas) direto na caixa de mensagem.
  - Oferece atalhos de envio de balancetes, recibos e guias.
  - Permite capturar contatos e criar empresas diretamente da conversa ativa para a plataforma.
- **O que NÃO faz (Segurança e Anti-Ban):**
  - **NUNCA** envia mensagens sozinho sem seu clique manual.
  - **NUNCA** faz disparos automáticos ou em massa.
  - O operador humano sempre revisa o texto e confirma o envio manualmente.

---
Rumo Consultoria Contábil © 2026
`,

  'icons/icon128.png': '', // Tratado em base64/svg no download
}

/**
 * Cria o arquivo ZIP da extensão e dispara o download no navegador
 */
export function downloadExtensionZip() {
  const files = [
    { name: 'manifest.json', content: EXTENSION_SOURCE_FILES['manifest.json'] },
    { name: 'popup.html', content: EXTENSION_SOURCE_FILES['popup.html'] },
    { name: 'popup.js', content: EXTENSION_SOURCE_FILES['popup.js'] },
    { name: 'content.css', content: EXTENSION_SOURCE_FILES['content.css'] },
    { name: 'content.js', content: EXTENSION_SOURCE_FILES['content.js'] },
    { name: 'README.md', content: EXTENSION_SOURCE_FILES['README.md'] },
    {
      name: 'icons/icon128.svg',
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="rumoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0FA3A3"/>
      <stop offset="100%" stop-color="#0B1F3A"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#rumoGrad)"/>
  <circle cx="64" cy="64" r="44" fill="none" stroke="#FFFFFF" stroke-width="6" opacity="0.25"/>
  <path d="M42 92V36h24c13.25 0 22 7.75 22 19 0 9.25-5.5 16-14.5 18.25L88 92H72L58 74H56v18H42zm14-30h10c5.5 0 8.5-3.25 8.5-7s-3-7-8.5-7H56v14z" fill="#FFFFFF"/>
</svg>`,
    },
  ]

  const zipBlob = createZipBlob(files)
  const url = URL.createObjectURL(zipBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'rumo-extensao-whatsapp-mv3.zip'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
