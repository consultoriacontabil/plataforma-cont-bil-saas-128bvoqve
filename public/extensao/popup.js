// popup.js - Gerencia as configurações da extensão Rumo
document.addEventListener('DOMContentLoaded', () => {
  const platformUrlInput = document.getElementById('platformUrl')
  const authTokenInput = document.getElementById('authToken')
  const saveBtn = document.getElementById('saveBtn')
  const testBtn = document.getElementById('testBtn')
  const statusMsg = document.getElementById('statusMsg')

  // Carregar configurações existentes salvas no chrome.storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['rumo_platform_url', 'rumo_auth_token'], (res) => {
      if (res.rumo_platform_url) {
        platformUrlInput.value = res.rumo_platform_url
      } else {
        // Padrão sugerido
        platformUrlInput.value = window.location.origin.includes('chrome-extension')
          ? 'https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev'
          : window.location.origin
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
    // Remove barra final
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
      // Tentar pingar api health ou templates
      const targetUrl = url.includes('internal.goskip.dev')
        ? `${url}/api/health`
        : `${url}/api/collections/whatsapp_templates/records?limit=1`

      const headers = {}
      if (token) {
        headers['Authorization'] = token
      }

      const res = await fetch(targetUrl, { headers })
      if (res.ok || res.status === 401 || res.status === 403) {
        showStatus('Servidor respondeu com sucesso! Conexão ativa.', 'success')
      } else {
        showStatus(`Status ${res.status}: verifique a URL e o token`, 'error')
      }
    } catch (err) {
      showStatus('Falha de rede ao conectar à URL configurada.', 'error')
    }
  })
})
