/**
 * Director Studio — API Proxy Server v2
 * 支持 SSE 流式代理 + 请求体大小限制 + 超时保护
 */
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

// ===== Load .env =====
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
}

// ===== Config =====
const PORT = process.env.PORT || 3001
const MAX_BODY_SIZE = 50 * 1024 * 1024  // 50MB (for image/video upload)
const REQUEST_TIMEOUT = 300_000          // 300s timeout
const STREAMING_CONTENT_TYPES = ['text/event-stream', 'application/x-ndjson']

// ===== Key Registry =====
const KEYS = {
  openai: process.env.OPENAI_API_KEY || '',
  deepseek: process.env.DEEPSEEK_API_KEY || '',
  minimax: process.env.MINIMAX_API_KEY || '',
  qwen: process.env.QWEN_API_KEY || '',
  glm: process.env.GLM_API_KEY || '',
  moonshot: process.env.MOONSHOT_API_KEY || '',
  seedance: process.env.SEEDANCE_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || '',
  kling: process.env.KLING_API_KEY || '',
  claude: process.env.CLAUDE_API_KEY || '',
  xiaomi: process.env.XIAOMI_API_KEY || '',
  agnes: process.env.AGNES_API_KEY || '',
}

// Hostname → Key provider mapping (supports wildcard subdomains)
const HOST_KEY_MAP = [
  ['api.deepseek.com', 'deepseek'],
  ['api.openai.com', 'openai'],
  ['api.anthropic.com', 'claude'],
  ['dashscope.aliyuncs.com', 'qwen'],
  ['open.bigmodel.cn', 'glm'],
  ['api.moonshot.cn', 'moonshot'],
  ['api.minimax.chat', 'minimax'],
  ['api.minimax.io', 'minimax'],
  ['generativelanguage.googleapis.com', 'gemini'],
  ['api.stability.ai', 'stability'],
  ['api.seedance.com', 'seedance'],
  ['api.klingai.com', 'kling'],
  ['ark.cn-beijing.volces.com', 'seedance'],
  ['apihub.agnes-ai.com', 'agnes'],
]

function getKeyForHost(hostname) {
  for (const [host, provider] of HOST_KEY_MAP) {
    if (hostname.includes(host)) return { key: KEYS[provider] || '', provider }
  }
  return { key: '', provider: 'unknown' }
}

// Auth header format per provider
function buildAuthHeader(hostname, key) {
  if (!key) return null
  // x-api-key style (DeepSeek, Anthropic, Google)
  if (hostname.includes('deepseek.com') || hostname.includes('anthropic.com')) {
    return ['x-api-key', key]
  }
  if (hostname.includes('generativelanguage.googleapis.com')) {
    return ['x-goog-api-key', key]
  }
  // Bearer token style (OpenAI, MiniMax, Qwen, etc.)
  return ['Authorization', `Bearer ${key}`]
}

// ===== Helpers =====
function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${level}: ${msg}`)
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}


// ===== Retry + Heartbeat + Error Helpers =====

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function doRequestWithRetry(proxyProto, options, body, res, provider, maxRetries) {
  let lastStatus = 0
  maxRetries = maxRetries || 3

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt) * 1000
      log('warn', `Retry ${attempt}/${maxRetries} after ${delay}ms (HTTP ${lastStatus})`)
      await sleep(delay)
    }
    try {
      const proxyRes = await new Promise((resolve, reject) => {
        const req = proxyProto.request(options, resolve)
        req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
        req.on('error', reject)
        if (body) req.write(body)
        req.end()
      })
      lastStatus = proxyRes.statusCode
      if (lastStatus === 429 || lastStatus === 503) {
        if (attempt < maxRetries) continue
      }
      return proxyRes
    } catch (e) {
      lastStatus = e.message === 'TIMEOUT' ? 504 : 502
      if (attempt < maxRetries) continue
      if (!res.headersSent) {
        res.writeHead(lastStatus, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          error: `请求失败(已重试${maxRetries}次): ${provider} ${lastStatus === 504 ? '超时' : '无法连接'}`,
          status: lastStatus
        }))
      }
      return null
    }
  }
  return null
}

function setupHeartbeat(proxyRes, clientRes) {
  let lastData = Date.now()
  const STALL_TIMEOUT = 300_000

  proxyRes.on('data', () => { lastData = Date.now() })

  const timer = setInterval(() => {
    if (Date.now() - lastData > STALL_TIMEOUT) {
      log('error', 'Stream stalled (no data 300s), closing')
      clearInterval(timer)
      clientRes.end()
    }
  }, 30_000)

  proxyRes.on('end', () => clearInterval(timer))
  proxyRes.on('error', () => clearInterval(timer))
  clientRes.on('close', () => clearInterval(timer))
}

// ===== Server =====const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key,x-goog-api-key,Accept')

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end()
    return
  }

  // Health check
  if (req.url === '/health') {
    const configured = Object.entries(KEYS).filter(([, v]) => v).map(([k]) => k)
    json(res, 200, { status: 'ok', configured })
    return
  }

  // Proxy /api/{absolute-url} → target
  if (!req.url.startsWith('/api/')) {
    json(res, 404, { error: 'Not found. Use /api/{target-url} or /health' })
    return
  }

  const targetUrl = req.url.slice(4)
  let target
  try {
    target = new URL(decodeURIComponent(targetUrl))
    if (!target.hostname) throw new Error('No hostname')
  } catch {
    json(res, 400, { error: 'Invalid target URL. Must be absolute: /api/https://api.openai.com/...' })
    return
  }

  const { key, provider } = getKeyForHost(target.hostname)
  const auth = buildAuthHeader(target.hostname, key)

  log('info', `${req.method} → ${target.hostname}${target.pathname.slice(0, 60)} [key: ${provider}${key ? '' : ' MISSING'}]`)

  // Collect body with size limit
  let body = ''
  let bodySize = 0
  req.on('data', (chunk) => {
    bodySize += chunk.length
    if (bodySize > MAX_BODY_SIZE) {
      log('warn', `Body too large: ${bodySize} bytes`)
      if (!res.headersSent) json(res, 413, { error: 'Request body too large (>50MB)' })
      req.destroy()
      return
    }
    body += chunk
  })

  req.on('end', () => {
    const reqHeaders = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'Accept': req.headers['accept'] || '*/*',
    }
    // Inject API key as auth header
    if (auth) {
      reqHeaders[auth[0]] = auth[1]
    }

    const options = {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers: reqHeaders,
      timeout: REQUEST_TIMEOUT,
    }

    const proxyProto = target.protocol === 'https:' ? https : http

    doRequestWithRetry(proxyProto, options, body, res, provider).then(proxyRes => {
      if (!proxyRes) return

      const status = proxyRes.statusCode
      const isStream = STREAMING_CONTENT_TYPES.some(t =>
        (proxyRes.headers['content-type'] || '').includes(t))

      log('info', `← ${status}${isStream ? ' [stream]' : ''}`)

      const resHeaders = { ...proxyRes.headers }
      delete resHeaders['transfer-encoding']
      delete resHeaders['connection']
      delete resHeaders['keep-alive']

      res.writeHead(status, resHeaders)

      if (isStream) {
        setupHeartbeat(proxyRes, res)
        proxyRes.pipe(res)
      } else {
        let resBody = ''
        proxyRes.on('data', (chunk) => { resBody += chunk })
        proxyRes.on('end', () => { res.end(resBody) })
      }
    })
  })
})

server.listen(PORT, () => {
  const configured = Object.entries(KEYS).filter(([, v]) => v).map(([k]) => k)
  log('info', `Director Studio Proxy v2 — http://localhost:${PORT}`)
  log('info', `Keys configured: ${configured.length ? configured.join(', ') : 'NONE (edit backend/.env)'}`)
  if (!configured.length) log('warn', 'No API keys configured — proxy will forward requests without auth')
})
