import { useState, useEffect, useRef, useCallback } from 'react'

const API = 'http://localhost:3001'

export default function LoginModal({ onLogin, onClose }) {
  const [step, setStep] = useState(1) // 1=phone, 2=sms, 3=invite
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [smsCooldown, setSmsCooldown] = useState(0)
  const [smsSent, setSmsSent] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [step])

  // SMS cooldown timer
  useEffect(() => {
    if (smsCooldown <= 0) return
    const t = setInterval(() => setSmsCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [smsCooldown])

  const handleSendSMS = useCallback(async () => {
    const p = phone.replace(/\D/g, '')
    if (!/^1[3-9]\d{9}$/.test(p)) { setError('请输入有效的手机号'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/api/auth/send-sms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || '发送失败'); setLoading(false); return }
      setSmsSent(true)
      setSmsCooldown(60)
      setStep(2)
    } catch { setError('无法连接服务器，请确保后端已启动') }
    setLoading(false)
  }, [phone])

  const handleVerifySMS = useCallback(async () => {
    const sc = smsCode.replace(/\D/g, '')
    if (sc.length !== 6) { setError('请输入6位验证码'); return }
    setError('')
    setStep(3)
  }, [smsCode])

  const handleLogin = useCallback(async () => {
    const ic = inviteCode.trim()
    if (ic.length !== 8) { setError('邀请码为8位字符'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ''), smsCode: smsCode.replace(/\D/g, ''), inviteCode: ic }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || '登录失败'); setLoading(false); return }
      // Success — save auth to localStorage
      localStorage.setItem('ds_auth', JSON.stringify({ token: d.token, user: d.user, phone: phone.replace(/\D/g, '') }))
      onLogin(d.user)
    } catch { setError('无法连接服务器') }
    setLoading(false)
  }, [inviteCode, phone, smsCode, onLogin])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, padding: 32, minWidth: 340, maxWidth: 400,
        border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', animation: 'fadeIn 0.25s ease' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎬</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>导演工作室</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>需要邀请码才能使用</p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              width: 28, height: 2, borderRadius: 1,
              background: s <= step ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Step 1: Phone */}
        {step === 1 && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>手机号</label>
            <input ref={inputRef} type="tel" value={phone} maxLength={11}
              onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleSendSMS() }}
              placeholder="输入手机号"
              style={{ width: '100%', padding: '11px 14px', fontSize: 15, borderRadius: 8,
                border: error ? '2px solid #ef4444' : '1px solid var(--border)',
                background: 'var(--bg-input)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>}
            <button onClick={handleSendSMS} disabled={loading || phone.length !== 11}
              style={{ width: '100%', marginTop: 16, padding: '11px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: phone.length === 11 ? 1 : 0.5 }}>
              {loading ? '发送中...' : '获取验证码'}
            </button>
          </div>
        )}

        {/* Step 2: SMS */}
        {step === 2 && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              短信验证码 <span style={{ color: 'var(--text-dim)' }}>→ {phone.replace(/\D/g, '').replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span>
            </label>
            <input ref={inputRef} type="text" value={smsCode} maxLength={6}
              onChange={e => { setSmsCode(e.target.value.replace(/\D/g, '')); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleVerifySMS() }}
              placeholder="输入6位验证码"
              style={{ width: '100%', padding: '11px 14px', fontSize: 20, letterSpacing: 6, textAlign: 'center',
                borderRadius: 8, border: error ? '2px solid #ef4444' : '1px solid var(--border)',
                background: 'var(--bg-input)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>}
            <button onClick={handleVerifySMS} disabled={smsCode.length !== 6}
              style={{ width: '100%', marginTop: 16, padding: '11px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: smsCode.length === 6 ? 1 : 0.5 }}>
              下一步
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
              <button onClick={() => { if (smsCooldown <= 0) handleSendSMS() }} disabled={smsCooldown > 0}
                style={{ background: 'none', border: 'none', color: smsCooldown > 0 ? 'var(--text-dim)' : 'var(--accent)', cursor: smsCooldown > 0 ? 'default' : 'pointer' }}>
                {smsCooldown > 0 ? `重发(${smsCooldown}s)` : '重新发送'}
              </button>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                更换手机号
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Invite Code */}
        {step === 3 && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>邀请码</label>
            <input ref={inputRef} type="text" value={inviteCode} maxLength={8}
              onChange={e => { setInviteCode(e.target.value.toUpperCase()); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
              placeholder="输入8位邀请码"
              style={{ width: '100%', padding: '11px 14px', fontSize: 18, letterSpacing: 4, textAlign: 'center',
                textTransform: 'uppercase', borderRadius: 8,
                border: error ? '2px solid #ef4444' : '1px solid var(--border)',
                background: 'var(--bg-input)', color: 'var(--text)', outline: 'none', fontFamily: 'monospace' }} />
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, textAlign: 'center' }}>
              🔑 邀请码由创作者发放，10分钟内有效，每人限用一个
            </p>
            {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, textAlign: 'center' }}>{error}</div>}
            <button onClick={handleLogin} disabled={loading || inviteCode.length !== 8}
              style={{ width: '100%', marginTop: 16, padding: '11px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: inviteCode.length === 8 ? 1 : 0.5 }}>
              {loading ? '验证中...' : '🎬 进入导演工作室'}
            </button>
            <button onClick={() => setStep(2)} style={{ width: '100%', marginTop: 8, padding: '6px', background: 'transparent',
              border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              ← 返回
            </button>
          </div>
        )}

        {/* Close button (only if user is returning, not first time) */}
        {onClose && (
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>×</button>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}
