/**
 * Director Studio — API Proxy Server
 * 后端持有所有 API Key，前端无需配置
 * 启动: node backend/server.js
 */
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

// Load .env
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

// API Key mapping — 提供商 → 环境变量
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
}

// Model → Key provider mapping
const MODEL_KEY_MAP = {
  // Chat models
  'api.deepseek.com': 'deepseek',
  'api.openai.com': 'openai',
  'api.anthropic.com': 'claude',
  'dashscope.aliyuncs.com': 'qwen',
  'open.bigmodel.cn': 'glm',
  'api.moonshot.cn': 'moonshot',
  'api.minimax.chat': 'minimax',
  'api.minimax.io': 'minimax',
  'generativelanguage.googleapis.com': 'gemini',
  // Image models
  'api.stability.ai': 'stability',
  'api.midjourney.com': 'midjourney',
  // Video models
  'api.seedance.com': 'seedance',
  'api.klingai.com': 'kling',
}

function getKeyForHost(hostname) {
  for (const [host, provider] of Object.entries(MODEL_KEY_MAP)) {
    if (hostname.includes(host)) return KEYS[provider] || ''
  }
  // Fallback: try OpenAI key for unknown hosts
  return KEYS.openai || ''
}

function getAuthHeader(hostname, key) {
  if (hostname.includes('deepseek.com')) return 'x-api-key'
  if (hostname.includes('anthropic.com')) return 'x-api-key'
  if (hostname.includes('generativelanguage.googleapis.com')) return 'x-goog-api-key'
  if (hostname.includes('dashscope.aliyuncs.com')) return 'Authorization'
  return 'Authorization'
}

function getAuthPrefix(hostname) {
  if (hostname.includes('deepseek.com')) return ''
  if (hostname.includes('anthropic.com')) return ''
  if (hostname.includes('generativelanguage.googleapis.com')) return ''
  return 'Bearer '
}

const PORT = process.env.PORT || 3001

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key,x-goog-api-key')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Health check
  if (req.url === '/health') {
    const configured = Object.entries(KEYS).filter(([, v]) => v).map(([k]) => k)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', configured }))
    return
  }

  // Proxy /api/* → target server
  if (req.url.startsWith('/api/')) {
    const url = req.url.slice(4) // Remove /api prefix
    if (!url.startsWith('http')) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'URL must be absolute: /api/https://...' }))
      return
    }

    const target = new URL(url)
    const key = getKeyForHost(target.hostname)
    const authHeader = getAuthHeader(target.hostname, key)
    const authPrefix = getAuthPrefix(target.hostname)

    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const headers = {
        'Content-Type': req.headers['content-type'] || 'application/json',
      }
      // Inject API key
      if (key) {
        headers[authHeader] = authPrefix + key
      }

      const options = {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + target.search,
        method: req.method,
        headers,
      }

      const proxy = target.protocol === 'https:' ? https : http
      const proxyReq = proxy.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res)
      })

      proxyReq.on('error', (e) => {
        console.error('Proxy error:', e.message)
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Proxy error: ${e.message}` }))
      })

      if (body) proxyReq.write(body)
      proxyReq.end()
    })
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  const configured = Object.entries(KEYS).filter(([, v]) => v).map(([k]) => k)
  console.log(`\n  Director Studio Proxy`)
  console.log(`  → http://localhost:${PORT}`)
  console.log(`  → /health to check status`)
  console.log(`  → /api/{target-url} to proxy requests`)
  console.log(`\n  Keys configured: ${configured.length ? configured.join(', ') : 'NONE — edit backend/.env'}\n`)
})
