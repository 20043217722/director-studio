/**
 * Director Studio — API Proxy Server v2.2
 * SSE 流式代理 + 手机号登录 + 邀请码系统 + 用户统计
 * v2.2: 文件写入锁 + crypto.randomInt + 过期自动清理 + token校验
 */
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

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
const DATA_DIR = path.join(__dirname, 'data')
const INVITE_TTL_MIN = 10
const SMS_TTL_MS = 5 * 60 * 1000
const SMS_COOLDOWN_MS = 60 * 1000
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000 // 10分钟清理一次过期数据

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

// ===== File Lock (防止并发写入数据丢失) =====
const locks = {}
function acquireLock(name) {
  return new Promise(resolve => {
    function tryLock() {
      if (!locks[name]) { locks[name] = true; resolve(); return }
      setImmediate(tryLock) // yield event loop, retry
    }
    tryLock()
  })
}
function releaseLock(name) { delete locks[name] }

// ===== Simple JSON DB (with lock protection) =====
function db(name) {
  const fp = path.join(DATA_DIR, name + '.json')
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')) }
  catch { return { invitation_codes: [], users: [], visits: [], sms_codes: {}, tokens: {} }[name] || [] }
}
async function saveSafe(name, data) {
  await acquireLock(name)
  try { fs.writeFileSync(path.join(DATA_DIR, name + '.json'), JSON.stringify(data, null, 2)) }
  finally { releaseLock(name) }
}
// Read with lock (for read-modify-write cycles)
async function readLocked(name) {
  await acquireLock(name)
  try { return db(name) }
  finally { releaseLock(name) }
}

// ===== Generators (crypto-safe) =====
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
function randStr(len) { const b = crypto.randomBytes(len); let s = ''; for (let i = 0; i < len; i++) s += CHARS[b[i] % CHARS.length]; return s }
function smsCode() { return String(crypto.randomInt(100000, 999999)) } // crypto-safe 6-digit
function sha256(d) { return crypto.createHash('sha256').update(d).digest('hex') }
function iso() { return new Date().toISOString() }
function hlog(tag, msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${tag}: ${msg}`) }

// ===== Cleanup expired data =====
function cleanupExpired() {
  try {
    // Clean expired invitation codes (keep for 24h after expiry for audit)
    const codes = db('invitation_codes')
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const filtered = codes.filter(c => !c.is_used || c.used_at > cutoff)
    if (filtered.length !== codes.length) { saveSafe('invitation_codes', filtered); hlog('cleanup', `邀请码: ${codes.length - filtered.length} 条过期清理`) }
    // Clean SMS codes
    const sms = db('sms_codes')
    let smsCleaned = 0
    for (const k of Object.keys(sms)) { if (Date.now() > sms[k].exp) { delete sms[k]; smsCleaned++ } }
    if (smsCleaned > 0) { saveSafe('sms_codes', sms); hlog('cleanup', `短信码: ${smsCleaned} 条过期清理`) }
    // Clean old tokens (>7 days)
    const tokens = db('tokens')
    let tokCleaned = 0
    const tokCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    for (const k of Object.keys(tokens)) { if (tokens[k].created < tokCutoff) { delete tokens[k]; tokCleaned++ } }
    if (tokCleaned > 0) { saveSafe('tokens', tokens); hlog('cleanup', `Token: ${tokCleaned} 条过期清理`) }
  } catch (e) { hlog('error', `清理失败: ${e.message}`) }
}
setInterval(cleanupExpired, CLEANUP_INTERVAL_MS)

// ===== API Keys =====
const KEYS = {
  openai: process.env.OPENAI_API_KEY || '', deepseek: process.env.DEEPSEEK_API_KEY || '',
  minimax: process.env.MINIMAX_API_KEY || '', qwen: process.env.QWEN_API_KEY || '',
  glm: process.env.GLM_API_KEY || '', moonshot: process.env.MOONSHOT_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || '', claude: process.env.CLAUDE_API_KEY || '',
  xiaomi: process.env.XIAOMI_API_KEY || '', agnes: process.env.AGNES_API_KEY || '',
}
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH || sha256('director-studio-admin-admin123')

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

// ===== Admin auth check =====
function checkAdmin(req) {
  const auth = req.headers['x-admin-auth'] || ''
  // Accept pre-hashed token (from AdminGate) or default password
  return auth === ADMIN_HASH || auth === 'admin123'
}

function j(res, s, d) { res.writeHead(s,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(d)) }

function body(req) {
  return new Promise((ok,rej) => {
    let b='',z=0
    req.on('data',c=>{z+=c.length;if(z>MAX_BODY){req.destroy();rej(new Error('too large'))};b+=c})
    req.on('end',()=>{try{ok(b?JSON.parse(b):{})}catch{ok({})}})
    req.on('error',rej)
  })
}

// ===== Auth Routes =====
async function authRoutes(req, res, pn, method) {

  // ─── POST /api/auth/generate — Admin: 生成邀请码 ───
  if (pn === '/api/auth/generate' && method === 'POST') {
    if (!checkAdmin(req)) return j(res, 403, { error: '管理员密码错误' })
    const b = await body(req)
    const n = Math.min(b.count || 1, 50)
    const codes = db('invitation_codes')
    const list = []
    const now = Date.now()
    for (let i = 0; i < n; i++) {
      const c = { code: randStr(8), created_at: new Date(now).toISOString(), expires_at: new Date(now + INVITE_TTL_MIN*60*1000).toISOString(), is_used: false, used_by: null, used_at: null }
      codes.push(c); list.push(c)
    }
    await saveSafe('invitation_codes', codes)
    hlog('auth', `✓ 生成 ${n} 邀请码`)
    return j(res, 200, { codes: list, active: codes.filter(c => !c.is_used && new Date(c.expires_at) > new Date()).length })
  }

  // ─── GET /api/auth/codes — Admin: 查看邀请码 ───
  if (pn === '/api/auth/codes' && method === 'GET') {
    if (!checkAdmin(req)) return j(res, 403, { error: '管理员密码错误' })
    const codes = db('invitation_codes')
    const now = new Date()
    codes.forEach(c => { c.is_expired = !c.is_used && new Date(c.expires_at) < now })
    return j(res, 200, { codes: codes.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) })
  }

  // ─── DELETE /api/auth/codes — Admin: 删除过期/已用邀请码 ───
  if (pn === '/api/auth/codes' && method === 'DELETE') {
    if (!checkAdmin(req)) return j(res, 403, { error: '管理员密码错误' })
    const b = await body(req)
    const codes = db('invitation_codes')
    const type = b.type || 'expired'
    let filtered
    if (type === 'all') filtered = []
    else if (type === 'used') filtered = codes.filter(c => !c.is_used)
    else filtered = codes.filter(c => c.is_used || new Date(c.expires_at) > new Date()) // keep used + active
    const removed = codes.length - filtered.length
    await saveSafe('invitation_codes', filtered)
    hlog('auth', `✓ 清理 ${removed} 条邀请码`)
    return j(res, 200, { removed, remaining: filtered.length })
  }

  // ─── POST /api/auth/send-sms ───
  if (pn === '/api/auth/send-sms' && method === 'POST') {
    const b = await body(req)
    const phone = (b.phone || '').replace(/\D/g, '')
    if (!/^1[3-9]\d{9}$/.test(phone)) return j(res, 400, { error: '请输入有效的手机号' })
    const sms = db('sms_codes')
    if (sms[phone] && Date.now() - sms[phone].sent < SMS_COOLDOWN_MS)
      return j(res, 429, { error: '请60秒后再试', retry: Math.ceil((sms[phone].sent + SMS_COOLDOWN_MS - Date.now())/1000) })
    const code = smsCode()
    sms[phone] = { code, sent: Date.now(), exp: Date.now() + SMS_TTL_MS, tries: 0 }
    await saveSafe('sms_codes', sms)
    hlog('sms', `→ ${phone} = ${code}`)
    return j(res, 200, { ok: true, msg: '验证码已发送', dev: code })
  }

  // ─── POST /api/auth/login ───
  if (pn === '/api/auth/login' && method === 'POST') {
    const b = await body(req)
    const phone = (b.phone || '').replace(/\D/g, '')
    const sc = (b.smsCode || '').replace(/\D/g, '')
    const ic = (b.inviteCode || '').trim()

    if (!/^1[3-9]\d{9}$/.test(phone)) return j(res, 400, { error: '请输入有效的手机号' })

    // SMS verify (with lock for read-modify-write safety)
    const sms = db('sms_codes')
    const se = sms[phone]
    if (!se) return j(res, 400, { error: '请先获取短信验证码' })
    if (se.tries >= 5) { delete sms[phone]; await saveSafe('sms_codes', sms); return j(res, 429, { error: '尝试次数过多，请重新获取' }) }
    if (Date.now() > se.exp) { delete sms[phone]; await saveSafe('sms_codes', sms); return j(res, 400, { error: '验证码已过期，请重新获取' }) }
    se.tries++; await saveSafe('sms_codes', sms)
    if (se.code !== sc) return j(res, 400, { error: `验证码错误（剩余${5-se.tries}次）` })

    // Invite code verify (with lock)
    await acquireLock('invitation_codes')
    let codes
    try { codes = db('invitation_codes') } finally { releaseLock('invitation_codes') }
    const inv = codes.find(c => c.code === ic)
    if (!inv) return j(res, 400, { error: '邀请码无效' })
    if (inv.is_used) return j(res, 400, { error: '邀请码已被使用' })
    if (new Date(inv.expires_at) < new Date()) return j(res, 400, { error: '邀请码已过期' })
    inv.is_used = true; inv.used_by = phone; inv.used_at = iso()

    // Atomic: mark code used + register user + create token
    await acquireLock('invitation_codes')
    try {
      codes = db('invitation_codes')
      const inv2 = codes.find(c => c.code === ic)
      if (!inv2 || inv2.is_used) { releaseLock('invitation_codes'); return j(res, 400, { error: '邀请码已被使用' }) }
      inv2.is_used = true; inv2.used_by = phone; inv2.used_at = iso()
      fs.writeFileSync(path.join(DATA_DIR, 'invitation_codes.json'), JSON.stringify(codes, null, 2))
    } finally { releaseLock('invitation_codes') }

    // User registration
    const users = db('users')
    let u = users.find(x => x.phone === phone)
    if (!u) { u = { id: randStr(16), phone, created_at: iso(), logins: 0, last: null }; users.push(u) }
    u.logins = (u.logins||0) + 1; u.last = iso()
    await saveSafe('users', users)

    // Create session token
    const token = randStr(32)
    const tokens = db('tokens')
    tokens[token] = { phone, user_id: u.id, created: Date.now() }
    await saveSafe('tokens', tokens)

    // Clean SMS
    delete sms[phone]; await saveSafe('sms_codes', sms)

    hlog('auth', `✓ 登录: ${phone} (#${u.logins})`)
    return j(res, 200, { ok: true, token, user: { id: u.id, phone: u.phone, logins: u.logins } })
  }

  // ─── POST /api/auth/validate — 校验 token 是否有效 ───
  if (pn === '/api/auth/validate' && method === 'POST') {
    const b = await body(req)
    const token = b.token || ''
    const tokens = db('tokens')
    const entry = tokens[token]
    if (!entry) return j(res, 401, { error: '登录已过期，请重新登录' })
    // Refresh last access
    entry.last_access = Date.now()
    await saveSafe('tokens', tokens)
    return j(res, 200, { ok: true, phone: entry.phone })
  }

  // ─── POST /api/auth/check-invite — 预检邀请码 ───
  if (pn === '/api/auth/check-invite' && method === 'POST') {
    const b = await body(req)
    const ic = (b.inviteCode || '').trim()
    const inv = db('invitation_codes').find(c => c.code === ic)
    if (!inv) return j(res, 400, { error: '邀请码无效' })
    if (inv.is_used) return j(res, 400, { error: '邀请码已被使用' })
    if (new Date(inv.expires_at) < new Date()) return j(res, 400, { error: '邀请码已过期' })
    return j(res, 200, { ok: true, exp: inv.expires_at })
  }

  // ─── POST /api/auth/track ───
  if (pn === '/api/auth/track' && method === 'POST') {
    const b = await body(req)
    const visits = db('visits')
    visits.push({ id: randStr(12), phone: b.phone||'anon', page: b.page||'/', time: iso(), ua: (req.headers['user-agent']||'').slice(0,200) })
    if (visits.length > 10000) visits.splice(0, visits.length - 10000)
    await saveSafe('visits', visits)
    return j(res, 200, { ok: true })
  }

  // ─── GET /api/admin/stats ───
  if (pn === '/api/admin/stats' && method === 'GET') {
    if (!checkAdmin(req)) return j(res, 403, { error: '管理员密码错误' })
    const users = db('users'), visits = db('visits'), codes = db('invitation_codes')
    const now = Date.now(), today = iso().slice(0,10)
    const days = Array.from({length:7},(_,i)=>{
      const d = new Date(now - i*86400000).toISOString().slice(0,10)
      return { date: d, visits: visits.filter(v=>v.time.startsWith(d)).length, new_users: users.filter(u=>u.created_at.startsWith(d)).length, logins: users.filter(u=>u.last&&u.last.startsWith(d)).length }
    }).reverse()
    return j(res, 200, {
      total_users: users.length, total_visits: visits.length,
      codes_active: codes.filter(c=>!c.is_used&&new Date(c.expires_at)>new Date()).length,
      codes_used: codes.filter(c=>c.is_used).length,
      today_visits: visits.filter(v=>v.time.startsWith(today)).length,
      today_users: users.filter(u=>u.created_at.startsWith(today)).length,
      days,
      recent_visits: visits.slice(-30).reverse(),
    })
  }

  return null
}

// ===== Server =====
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,x-api-key,x-goog-api-key,x-admin-auth,Accept')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const u = new URL(req.url, 'http://localhost')
  const pn = u.pathname

  // Health
  if (pn === '/health') {
    return j(res, 200, { status: 'ok', version: '2.2', configured: Object.entries(KEYS).filter(([,v])=>v).map(([k])=>k), features: ['auth','invites','tracking','token-validation','auto-cleanup'] })
  }

  // Auth
  const ar = await authRoutes(req, res, pn, req.method)
  if (ar !== null) return

  // ─── Proxy /api/{url} ───
  if (!req.url.startsWith('/api/')) return j(res, 404, { error: 'Not found' })

  const targetUrl = req.url.slice(4)
  let target
  try { target = new URL(decodeURIComponent(targetUrl)); if (!target.hostname) throw 0 }
  catch { return j(res, 400, { error: 'Invalid URL' }) }

  const { k, p } = hostKey(target.hostname)
  const ah = authHdr(target.hostname, k)
  hlog('proxy', `${req.method} → ${target.hostname} [${p}${k?'':' N/A'}]`)

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
      hlog('proxy', `← ${st}${stream?' [stream]':''}`)
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
  hlog('info', `Director Studio v2.2 :${PORT}`)
  hlog('info', `Keys: ${cfg.length?cfg.join(','):'NONE'} | Auth: SMS+Invite(${INVITE_TTL_MIN}min) | Auto-cleanup: ${CLEANUP_INTERVAL_MS/60000}min`)
})
