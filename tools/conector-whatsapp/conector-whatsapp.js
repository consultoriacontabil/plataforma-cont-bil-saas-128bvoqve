/**
 * Conector Rumo Whats — sessão WhatsApp pareada por QR Code (Baileys).
 *
 * Processo Node SEPARADO — roda na máquina do escritório, não no Skip Cloud.
 * A sessão precisa ficar aberta com chaves rotacionando, o que um hook
 * PocketBase (request/response) não suporta.
 *
 * Rotas expostas:
 *   GET  /qr.png      — QR como imagem, para a Tela 01 do painel
 *   GET  /estado      — conectado ou não, tem QR, número pareado, último erro
 *   POST /recarregar  — descarta a sessão e gera QR novo
 *
 * Instalação (na máquina do escritório):
 *   mkdir conector-rumo-whats && cd conector-rumo-whats
 *   npm i @whiskeysockets/baileys qrcode pino @hapi/boom express
 *   cp conector-whatsapp.js .
 *   # variáveis de ambiente:
 *   #   RUMO_WEBHOOK_URL  — ex. https://SEU-PROJETO.goskip.app/backend/v1/rumo-whats/webhook
 *   #   WA_WEBHOOK_TOKEN  — o mesmo token configurado na plataforma (set_env)
 *   #   RUMO_CANAL_ID     — id do registro em wa_canais (modo "qr")
 *   #   WA_AUTH_DIR       — pasta das credenciais, FORA do git (ex. /var/lib/rumo-whats/auth)
 *   node conector-whatsapp.js
 *   # QR disponível em http://127.0.0.1:8095/qr.png
 *
 * RISCO (documentado pela Meta): pareamento por QR (Baileys) é "app não oficial"
 * para o WhatsApp — o número pode ser banido. Use número DEDICADO ao atendimento,
 * nunca o principal do escritório.
 */

const express = require('express')
const pino = require('pino')
const QRCode = require('qrcode')
const { Boom } = require('@hapi/boom')
const makeWASocket = require('@whiskeysockets/baileys').default
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys')

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT || 8095)
const RUMO_WEBHOOK_URL = process.env.RUMO_WEBHOOK_URL || ''
const WA_WEBHOOK_TOKEN = process.env.WA_WEBHOOK_TOKEN || ''
const RUMO_CANAL_ID = process.env.RUMO_CANAL_ID || ''
const WA_AUTH_DIR = process.env.WA_AUTH_DIR || './auth_info'
const LAZO_ENVIO_MS = Number(process.env.WA_ENVIO_INTERVALO_MS || 8000)

if (!RUMO_WEBHOOK_URL || !WA_WEBHOOK_TOKEN) {
  console.error(
    '[conector] RUMO_WEBHOOK_URL e WA_WEBHOOK_TOKEN são obrigatórios. Veja o cabeçalho deste arquivo.',
  )
  process.exit(1)
}

const logger = pino({ level: 'warn' })

// ---------------------------------------------------------------------------
// Estado compartilhado
// ---------------------------------------------------------------------------
const estado = {
  conectado: false,
  temQr: false,
  numeroPareado: null,
  ultimoErro: null,
  qrAtualizadoEm: null,
  conectadoEm: null,
  iniciadoEm: new Date().toISOString(),
  desistiuAposLogout: false, // não recriar sessão em laço após loggedOut (padrão de abuso)
}

let sock = null
let qrDataUrl = null
let lazoEnvioTimer = null

// ---------------------------------------------------------------------------
// Sessão Baileys
// ---------------------------------------------------------------------------
async function iniciarSessao() {
  if (estado.desistiuAposLogout) {
    console.warn(
      '[conector] Sessão encerrada pelo aparelho (loggedOut). Recarregue via POST /recarregar para gerar QR novo — não reconecto automaticamente.',
    )
    return
  }
  const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: ['Rumo Whats', 'Chrome', '120.0.0'],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 })
      estado.temQr = true
      estado.qrAtualizadoEm = new Date().toISOString()
      estado.conectado = false
      console.log('[conector] QR novo gerado (renovado automaticamente).')
    }

    if (connection === 'open') {
      estado.conectado = true
      estado.temQr = false
      estado.ultimoErro = null
      estado.conectadoEm = new Date().toISOString()
      const me = sock.user && sock.user.id ? String(sock.user.id).split(':')[0] : null
      estado.numeroPareado = me
      qrDataUrl = null
      console.log('[conector] Sessão aberta. Número pareado: ' + me)
      iniciarLacoEnvio()
    }

    if (connection === 'close') {
      const statusCode =
        lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
          ? lastDisconnect.error.output.statusCode
          : null
      estado.conectado = false
      pararLacoEnvio()

      if (statusCode === DisconnectReason.loggedOut) {
        estado.ultimoErro = 'Sessão deslogada pelo aparelho. Gere um QR novo.'
        estado.desistiuAposLogout = true
        console.warn(
          '[conector] loggedOut — não reconecto automaticamente (padrão de abuso per Meta).',
        )
        return
      }

      estado.ultimoErro = 'Conexão caiu (' + (statusCode || 'desconhecido') + '). Reconectando…'
      console.log(estado.ultimoErro)
      setTimeout(iniciarSessao, 3000)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !Array.isArray(messages)) return
    for (const m of messages) {
      try {
        if (!m.message || m.key.remoteId === 'status@broadcast') continue
        const conteudo =
          m.message.conversation ||
          (m.message.extendedTextMessage && m.message.extendedTextMessage.text) ||
          (m.message.imageMessage && m.message.imageMessage.caption) ||
          (m.message.documentMessage && m.message.documentMessage.caption) ||
          ''
        const apagada = !!(m.message.protocolMessage && m.message.protocolMessage.type === 0)
        await despacharWebhook({
          canal_id: RUMO_CANAL_ID,
          wamid: m.key.id,
          chat_jid: m.key.remoteJid,
          pushname: m.pushName || '',
          conteudo: conteudo,
          apagada: apagada,
          remetente_tipo: m.key.fromMe ? 'humano' : 'cliente',
        })
      } catch (errMsg) {
        console.error('[conector] Erro ao despachar mensagem ao webhook:', errMsg.message)
      }
    }
  })
}

async function despacharWebhook(payload) {
  const resp = await fetch(RUMO_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-rumo-token': WA_WEBHOOK_TOKEN },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) {
    console.error('[conector] Webhook respondeu ' + resp.status + ': ' + (await resp.text()))
  }
}

async function recarregarSessao() {
  pararLacoEnvio()
  try {
    if (sock) {
      sock.ev.removeAllListeners('connection.update')
      sock.ev.removeAllListeners('messages.upsert')
      try {
        await sock.logout()
      } catch (_) {
        try {
          sock.end()
        } catch (_) {}
      }
      sock = null
    }
  } catch (_) {}
  estado.conectado = false
  estado.temQr = false
  estado.numeroPareado = null
  estado.ultimoErro = null
  estado.desistiuAposLogout = false
  qrDataUrl = null
  await iniciarSessao()
}

// ---------------------------------------------------------------------------
// Laço de envio: lê pendentes na plataforma e despacha pelo socket
// ---------------------------------------------------------------------------
async function iniciarLacoEnvio() {
  pararLacoEnvio()
  lazoEnvioTimer = setInterval(async () => {
    try {
      if (!estado.conectado || !sock) return
      const base = RUMO_WEBHOOK_URL.replace(/\/webhook$/, '')
      const resp = await fetch(base + '/fila', {
        headers: { 'x-rumo-token': WA_WEBHOOK_TOKEN },
      })
      if (!resp.ok) return
      const dados = await resp.json()
      const itens = (dados && dados.itens) || []
      for (const item of itens) {
        try {
          const resultado = await sock.sendMessage(item.destino_jid, { text: item.conteudo })
          const wamid = resultado && resultado.key && resultado.key.id ? resultado.key.id : ''
          await fetch(base + '/fila/' + encodeURIComponent(item.id) + '/confirmar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-rumo-token': WA_WEBHOOK_TOKEN },
            body: JSON.stringify({ sucesso: true, wamid: wamid }),
          })
          console.log('[conector] Enviado ' + item.id + ' wamid=' + wamid)
        } catch (errEnvio) {
          await fetch(base + '/fila/' + encodeURIComponent(item.id) + '/confirmar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-rumo-token': WA_WEBHOOK_TOKEN },
            body: JSON.stringify({ sucesso: false, erro: errEnvio.message }),
          })
          console.error('[conector] Falha ao enviar ' + item.id + ': ' + errEnvio.message)
        }
      }
    } catch (errLazo) {
      console.error('[conector] Erro no laço de envio:', errLazo.message)
    }
  }, LAZO_ENVIO_MS)
}

function pararLacoEnvio() {
  if (lazoEnvioTimer) {
    clearInterval(lazoEnvioTimer)
    lazoEnvioTimer = null
  }
}

// ---------------------------------------------------------------------------
// HTTP: /qr.png, /estado, /recarregar
// ---------------------------------------------------------------------------
const app = express()
app.use(express.json())

app.get('/estado', (req, res) => {
  res.json({ ...estado, canal_id: RUMO_CANAL_ID || null })
})

app.get('/qr.png', async (req, res) => {
  if (!qrDataUrl) {
    return res.status(404).json({ error: 'Sem QR no momento. Faça POST /recarregar para gerar.' })
  }
  const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '')
  const buf = Buffer.from(base64, 'base64')
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Content-Length', buf.length)
  res.send(buf)
})

app.post('/recarregar', async (req, res) => {
  await recarregarSessao()
  res.json({ ok: true, mensagem: 'Sessão descartada; novo QR em segundos.' })
})

app.listen(PORT, () => {
  console.log('[conector] Rumo Whats conector em http://127.0.0.1:' + PORT)
  iniciarSessao().catch((err) => {
    console.error('[conector] Falha ao iniciar sessão:', err.message)
    estado.ultimoErro = err.message
  })
})
