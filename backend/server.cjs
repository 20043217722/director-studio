/**
 * Director Studio — API Proxy Server
 * SSE 流式代理
 */
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

// ===== Load .env =====
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const t = line.trim()
    if (!t || t.startsWith('#')) return
    const i = t.indexOf('=')
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  })
}

// ===== Config =====
const PORT = process.env.PORT || 3001
const MAX_BODY = 50 * 1024 * 1024
const TIMEOUT = 120_000
const STREAM_TYPES = ['text/event-stream', 'application/x-ndjson']

// ===== API Keys =====
const KEYS = {
  openai: process.env.OPENAI_API_KEY || '', deepseek: process.env.DEEPSEEK_API_KEY || '',
  minimax: process.env.MINIMAX_API_KEY || '', qwen: process.env.QWEN_API_KEY || '',
  glm: process.env.GLM_API_KEY || '', moonshot: process.env.MOONSHOT_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || '', claude: process.env.CLAUDE_API_KEY || '',
  xiaomi: process.env.XIAOMI_API_KEY || '', agnes: process.env.AGNES_API_KEY || '',
}

const HOST_MAP = [
  ['api.deepseek.com','deepseek'],['api.openai.com','openai'],['api.anthropic.com','claude'],
  ['dashscope.aliyuncs.com','qwen'],['open.bigmodel.cn','glm'],['api.moonshot.cn','moonshot'],
  ['api.minimax.chat','minimax'],['api.minimax.io','minimax'],['generativelanguage.googleapis.com','gemini'],
  ['ark.cn-beijing.volces.com','seedance'],['apihub.agnes-ai.com','agnes'],
]

function hostKey(h) { for (const [p,k] of HOST_MAP) if (h.includes(p)) return { k: KEYS[k]||'', p: k }; return { k: '', p: 'unknown' } }
function authHdr(h, k) {
  if (!k) return null
  if (h.includes('deepseek.com')||h.includes('anthropic.com')) return ['x-api-key',k]
  if (h.includes('generativelanguage.googleapis.com')) return ['x-goog-api-key',k]
  return ['Authorization',`Bearer ${k}`]
}

function log(tag, msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${tag}: ${msg}`) }
function j(res, s, d) { res.writeHead(s,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(d)) }

// ===== Server =====
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,x-api-key,x-goog-api-key,Accept')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const u = new URL(req.url, 'http://localhost')
  const pn = u.pathname

  // Health
  if (pn === '/health') {
    return j(res, 200, { status: 'ok', configured: Object.entries(KEYS).filter(([,v])=>v).map(([k])=>k) })
  }

  // Track visit (minimal)
  if (pn === '/api/auth/track' && req.method === 'POST') {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      try { const d = JSON.parse(b); log('visit', `page: ${d.page || '/'}`) } catch {}
      return j(res, 200, { ok: true })
    })
    return
  }

  // ─── Proxy /api/{url} ───
  if (!req.url.startsWith('/api/')) return j(res, 404, { error: 'Not found' })

  const targetUrl = req.url.slice(4)
  let target
  try { target = new URL(decodeURIComponent(targetUrl)); if (!target.hostname) throw 0 }
  catch { return j(res, 400, { error: 'Invalid URL' }) }

  const { k, p } = hostKey(target.hostname)
  const ah = authHdr(target.hostname, k)
  log('proxy', `${req.method} → ${target.hostname} [${p}${k?'':' N/A'}]`)

  let rb = '', rz = 0
  req.on('data', c => { rz += c.length; if (rz > MAX_BODY) { req.destroy(); if (!res.headersSent) j(res, 413, { error: '>50MB' }) }; rb += c })
  req.on('end', () => {
    const hdrs = { 'Content-Type': req.headers['content-type'] || 'application/json', 'Accept': req.headers['accept'] || '*/*' }
    if (ah) hdrs[ah[0]] = ah[1]
    const opts = { hostname: target.hostname, port: target.port || (target.protocol==='https:'?443:80), path: target.pathname+target.search, method: req.method, headers: hdrs, timeout: TIMEOUT }
    const proto = target.protocol === 'https:' ? https : http
    const preq = proto.request(opts, pres => {
      const st = pres.statusCode
      const stream = STREAM_TYPES.some(t => (pres.headers['content-type']||'').includes(t))
      log('proxy', `← ${st}${stream?' [stream]':''}`)
      const rh = { ...pres.headers }; delete rh['transfer-encoding']; delete rh['connection']; delete rh['keep-alive']
      res.writeHead(st, rh)
      stream ? pres.pipe(res) : (() => { let b = ''; pres.on('data', c => b += c); pres.on('end', () => res.end(b)) })()
    })
    preq.on('timeout', () => { preq.destroy(); if (!res.headersSent) j(res, 504, { error: 'timeout' }) })
    preq.on('error', e => { if (!res.headersSent) j(res, 502, { error: e.message }) })
    if (rb) preq.write(rb); preq.end()
  })
})

server.listen(PORT, () => {
  const cfg = Object.entries(KEYS).filter(([,v])=>v).map(([k])=>k)
  log('info', `Director Studio Proxy :${PORT}`)
  log('info', `Keys: ${cfg.length?cfg.join(','):'NONE'}`)
})
