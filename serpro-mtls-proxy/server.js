/**
 * Proxy mTLS reverso para SERPRO Integra Contador (Receita Federal / e-CAC).
 *
 * Objetivo:
 * O runtime JavaScript do PocketBase (Goja) não suporta anexar certificados de cliente
 * (mTLS) no handshake TLS para APIs que exigem autenticação e-CNPJ A1.
 * Este serviço Node.js puro escuta requisições HTTPS locais/protegidas e as encaminha
 * ao gateway do SERPRO (https://gateway.apiserpro.serpro.gov.br), injetando o certificado
 * digital A1 (PFX ou PEM cert/key) em toda chamada upstream via https.Agent.
 *
 * Dependências: Nenhuma externa. Utiliza módulos nativos node:https, node:http, node:fs, node:crypto, node:url.
 */

const https = require('node:https')
const http = require('node:http')
const fs = require('node:fs')
const crypto = require('node:crypto')
const url = require('node:url')

// Configurações via variáveis de ambiente
const PORT = parseInt(process.env.PORT || '8443', 10)
const HOST = process.env.HOST || '0.0.0.0'
const SERPRO_UPSTREAM = process.env.SERPRO_UPSTREAM || 'https://gateway.apiserpro.serpro.gov.br'
const UPSTREAM_URL = new url.URL(SERPRO_UPSTREAM)

// Certificado do Servidor HTTPS (para terminação local)
// Se não fornecido pelo usuário, geramos um par autoassinado em memória no boot
const SERVER_CERT_PATH = process.env.SERVER_CERT_PATH || ''
const SERVER_KEY_PATH = process.env.SERVER_KEY_PATH || ''

// Certificado Cliente mTLS para o SERPRO (opção A: PFX ou opção B: PEM cert + key)
const TLS_PFX_PATH = process.env.TLS_PFX_PATH || ''
const TLS_PFX_PASSPHRASE = process.env.TLS_PFX_PASSPHRASE || ''
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || ''
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || ''
const TLS_CA_PATH = process.env.TLS_CA_PATH || ''

// Allowlist de IPs (opcional)
// Formato: lista separada por vírgula (ex: "127.0.0.1,::1,192.168.1.50")
// Nota: Os IPs do Skip Cloud podem variar devido ao proxy de egress da infraestrutura compartilhada.
// Use com cautela ou restrinja na borda (Caddy / UFW / firewall).
const ALLOWED_IPS = (process.env.ALLOWED_IPS || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean)

/**
 * Utilitário: Gerar par de chaves e certificado autoassinado x509 simples em memória
 * caso o usuário não forneça certificados de servidor específicos.
 */
function generateSelfSignedServerCert() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  })

  // Usar WebCrypto / x509 interno disponível a partir do Node 15+
  // Para manter compatibilidade ampla e sem libs externas, montamos um certificado autoassinado básico
  // ou usamos fallback HTTP se estritamente configurado. No Node 19+, crypto.X509Certificate existe.
  // Criamos o certificado via crypto interno do Node:
  return {
    key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    // Quando Node não tem construtor nativo de criação de cert x509 em JS puro sem OpenSSL CLI,
    // usamos uma chave gerada e criamos o cert via openssl CLI se disponível, ou usamos fallback https/http.
  }
}

/**
 * Carrega a configuração do certificado cliente para o SERPRO
 */
function loadClientTlsOptions() {
  const agentOpts = {
    // SNI obrigatório para o gateway do SERPRO
    servername: UPSTREAM_URL.hostname,
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: 50,
  }

  let certFound = false

  // Opção A: Arquivo PFX / PKCS#12 (comum nos certificados A1 emitidos no Brasil)
  if (TLS_PFX_PATH) {
    if (!fs.existsSync(TLS_PFX_PATH)) {
      console.error(`[AVISO] TLS_PFX_PATH configurado (${TLS_PFX_PATH}), mas o arquivo não existe!`)
    } else {
      console.log(`[mTLS] Carregando certificado cliente A1 via PFX: ${TLS_PFX_PATH}`)
      agentOpts.pfx = fs.readFileSync(TLS_PFX_PATH)
      if (TLS_PFX_PASSPHRASE) {
        agentOpts.passphrase = TLS_PFX_PASSPHRASE
      }
      certFound = true
    }
  }

  // Opção B: Certificado e Chave PEM separados (convertidos via openssl)
  if (!certFound && TLS_CERT_PATH && TLS_KEY_PATH) {
    if (!fs.existsSync(TLS_CERT_PATH) || !fs.existsSync(TLS_KEY_PATH)) {
      console.error(`[AVISO] TLS_CERT_PATH ou TLS_KEY_PATH não encontrados no disco!`)
    } else {
      console.log(
        `[mTLS] Carregando certificado cliente A1 via PEM: cert=${TLS_CERT_PATH}, key=${TLS_KEY_PATH}`,
      )
      agentOpts.cert = fs.readFileSync(TLS_CERT_PATH)
      agentOpts.key = fs.readFileSync(TLS_KEY_PATH)
      if (TLS_PFX_PASSPHRASE) {
        agentOpts.passphrase = TLS_PFX_PASSPHRASE
      }
      certFound = true
    }
  }

  // CA adicional opcional (ex: cadeia da ICP-Brasil se necessário)
  if (TLS_CA_PATH && fs.existsSync(TLS_CA_PATH)) {
    console.log(`[mTLS] Carregando autoridade certificadora (CA): ${TLS_CA_PATH}`)
    agentOpts.ca = fs.readFileSync(TLS_CA_PATH)
  }

  if (!certFound) {
    console.warn('⚠️  [ATENÇÃO] Nenhum certificado cliente A1 carregado (nem PFX nem PEM).')
    console.warn(
      '⚠️  As requisições serão repassadas ao SERPRO sem o handshake mTLS e poderão ser recusadas pelo e-CAC.',
    )
  } else {
    console.log('✅ [mTLS] Certificado cliente A1 pronto para handshake mútuo com o SERPRO.')
  }

  return { agentOpts, certFound }
}

const { agentOpts: clientTlsOptions, certFound: hasClientCert } = loadClientTlsOptions()
const upstreamAgent = new https.Agent(clientTlsOptions)

/**
 * Carrega certificados do servidor para receber chamadas HTTPS
 */
function loadServerTlsCredentials() {
  if (SERVER_CERT_PATH && SERVER_KEY_PATH) {
    if (fs.existsSync(SERVER_CERT_PATH) && fs.existsSync(SERVER_KEY_PATH)) {
      console.log(`[HTTPS] Carregando certificado do servidor: ${SERVER_CERT_PATH}`)
      return {
        cert: fs.readFileSync(SERVER_CERT_PATH),
        key: fs.readFileSync(SERVER_KEY_PATH),
      }
    }
    console.warn(
      `[HTTPS] SERVER_CERT_PATH ou SERVER_KEY_PATH configurados, mas arquivos não encontrados.`,
    )
  }

  // Gerar par autoassinado temporário se OpenSSL estiver disponível no sistema
  try {
    const { execSync } = require('node:child_process')
    const tmpKey = '/tmp/serpro_server_key.pem'
    const tmpCert = '/tmp/serpro_server_cert.pem'
    if (!fs.existsSync(tmpKey) || !fs.existsSync(tmpCert)) {
      console.log('[HTTPS] Gerando certificado TLS autoassinado temporário para o servidor...')
      execSync(
        `openssl req -x509 -newkey rsa:2048 -nodes -keyout ${tmpKey} -out ${tmpCert} -days 365 -subj "/CN=serpro-mtls-proxy/O=Rumo/C=BR"`,
        { stdio: 'ignore' },
      )
    }
    return {
      key: fs.readFileSync(tmpKey),
      cert: fs.readFileSync(tmpCert),
    }
  } catch (err) {
    console.warn('[HTTPS] OpenSSL não disponível para gerar cert autoassinado:', err.message)
    return null
  }
}

/**
 * Validação de IP (se ALLOWED_IPS configurado)
 */
function isIpAllowed(clientIp) {
  if (ALLOWED_IPS.length === 0) return true
  const cleanIp = (clientIp || '').replace(/^.*:/, '')
  return ALLOWED_IPS.includes(clientIp) || ALLOWED_IPS.includes(cleanIp)
}

/**
 * Handler HTTP principal: processa healthcheck ou encaminha ao SERPRO
 */
function handleRequest(req, res) {
  const startTime = Date.now()
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''

  // 1. Verificação de IP (se allowlist ativa)
  if (!isIpAllowed(clientIp)) {
    console.warn(`[SEGURANÇA] Requisição bloqueada por IP não autorizado: ${clientIp}`)
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ erro: 'Acesso negado: IP não autorizado.', ip: clientIp }))
    return
  }

  const parsedUrl = url.parse(req.url, true)
  const pathname = parsedUrl.pathname || '/'

  // 2. Healthcheck local: não repassa ao SERPRO
  if (pathname === '/health' || pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        servico: 'serpro-mtls-proxy',
        upstream: SERPRO_UPSTREAM,
        mtls_a1_configurado: hasClientCert,
        uptime_segundos: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      }),
    )
    return
  }

  // 3. Montar cabeçalhos para o upstream
  // Preservamos todos os headers originais (Authorization, Content-Type, etc.)
  // Ajustando apenas Host e SNI para o gateway do SERPRO
  const upstreamHeaders = { ...req.headers }
  upstreamHeaders.host = UPSTREAM_URL.host
  // Remover cabeçalhos específicos de conexão hop-by-hop
  delete upstreamHeaders['connection']
  delete upstreamHeaders['keep-alive']
  delete upstreamHeaders['proxy-authenticate']
  delete upstreamHeaders['proxy-authorization']
  delete upstreamHeaders['te']
  delete upstreamHeaders['trailer']
  delete upstreamHeaders['transfer-encoding']
  delete upstreamHeaders['upgrade']

  const targetPath = (parsedUrl.path || '/').replace(/^\/+/, '/')
  const targetUrl = `${SERPRO_UPSTREAM.replace(/\/+$/, '')}/${targetPath.replace(/^\/+/, '')}`

  const requestOptions = {
    protocol: UPSTREAM_URL.protocol,
    hostname: UPSTREAM_URL.hostname,
    port: UPSTREAM_URL.port || (UPSTREAM_URL.protocol === 'https:' ? 443 : 80),
    method: req.method,
    path: targetPath,
    headers: upstreamHeaders,
    agent: upstreamAgent,
    timeout: 45000, // 45 segundos de timeout
  }

  // Log seguro: imprime método e caminho, SEM logar credenciais ou tokens
  const authHeaderPresent = Boolean(req.headers['authorization'])
  console.log(
    `[PROXY -> SERPRO] ${req.method} ${targetPath} (Auth: ${authHeaderPresent ? 'presente' : 'ausente'}, IP: ${clientIp})`,
  )

  const upstreamReq = https.request(requestOptions, (upstreamRes) => {
    const elapsedMs = Date.now() - startTime
    console.log(
      `[SERPRO -> PROXY] ${req.method} ${targetPath} => HTTP ${upstreamRes.statusCode} (${elapsedMs}ms)`,
    )

    // Repassar status e headers do upstream para o cliente
    res.writeHead(upstreamRes.statusCode, upstreamRes.headers)
    upstreamRes.pipe(res)
  })

  upstreamReq.on('timeout', () => {
    const elapsedMs = Date.now() - startTime
    console.error(`[ERRO] Timeout ao conectar no SERPRO (${elapsedMs}ms): ${targetPath}`)
    upstreamReq.destroy()
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          erro: 'Gateway Timeout: o SERPRO não respondeu no tempo limite de 45s.',
          duracao_ms: elapsedMs,
        }),
      )
    }
  })

  upstreamReq.on('error', (err) => {
    const elapsedMs = Date.now() - startTime
    console.error(`[ERRO] Falha na comunicação com o upstream SERPRO: ${err.message}`)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          erro: 'Bad Gateway: erro de conexão mTLS com o SERPRO.',
          detalhe: err.message,
          duracao_ms: elapsedMs,
        }),
      )
    }
  })

  // Envia o corpo da requisição cliente para o upstream
  req.pipe(upstreamReq)
}

// Iniciar Servidor
const serverCredentials = loadServerTlsCredentials()
let server

if (serverCredentials) {
  server = https.createServer(serverCredentials, handleRequest)
  console.log(`[INÍCIO] Modo HTTPS ativado com certificados locais.`)
} else {
  // Se não foi possível gerar/carregar cert HTTPS, roda em HTTP para que um reverse proxy
  // de borda (como Caddy / Nginx com Let's Encrypt) faça a terminação TLS externa.
  server = http.createServer(handleRequest)
  console.log(
    `[INÍCIO] Modo HTTP puro ativado (recomendado atrás de Caddy/Nginx com terminação TLS).`,
  )
}

server.listen(PORT, HOST, () => {
  console.log('==================================================================')
  console.log(`🚀 SERPRO Integra Contador mTLS Proxy rodando em ${HOST}:${PORT}`)
  console.log(`🎯 Upstream alvo: ${SERPRO_UPSTREAM}`)
  console.log(`🔐 Certificado cliente mTLS A1: ${hasClientCert ? 'ATIVO' : 'NÃO CONFIGURADO'}`)
  console.log(`🩺 Healthcheck disponível em: /health`)
  if (ALLOWED_IPS.length > 0) {
    console.log(`🛡️  Allowlist de IPs ativa: ${ALLOWED_IPS.join(', ')}`)
  }
  console.log('==================================================================')
})

// Tratamento de encerramento gracioso
function gracefulShutdown(signal) {
  console.log(`\n[FINALIZANDO] Recebido sinal ${signal}. Encerrando proxy mTLS...`)
  server.close(() => {
    console.log('[FINALIZANDO] Servidor encerrado com sucesso.')
    process.exit(0)
  })
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
