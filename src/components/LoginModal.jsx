import { useState, useRef, useCallback } from 'react'

const API = 'http://localhost:3001'

export default function LoginModal({ onLogin, onClose }) {
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleLogin = useCallback(async () => {
    const ic = inviteCode.trim()
    if (ic.length !== 8) { setError('邀请码为8位字符'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: ic }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || '登录失败'); setLoading(false); return }
      localStorage.setItem('ds_auth', JSON.stringify({ token: d.token, user: d.user }))
      onLogin(d.user)
    } catch { setError('无法连接服务器，请确保后端已启动 (npm start)') }
    setLoading(false)
  }, [inviteCode, onLogin])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', background: 'var(--bg-elevated)', borderRadius: 16, padding: 32, minWidth: 340, maxWidth: 400,
        border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', animation: 'fadeIn 0.25s ease' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎬</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>导演工作室</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>输入创作者发放的邀请码即可使用</p>
        </div>

        {/* Invite Code Input */}
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>邀请码</label>
        <input ref={inputRef} type="text" value={inviteCode} maxLength={8} autoFocus
          onChange={e => { setInviteCode(e.target.value.toUpperCase()); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
          placeholder="输入8位邀请码"
          style={{ width: '100%', padding: '13px 14px', fontSize: 20, letterSpacing: 5, textAlign: 'center',
            textTransform: 'uppercase', borderRadius: 8,
            border: error ? '2px solid #ef4444' : '1px solid var(--border)',
            background: 'var(--bg-input)', color: 'var(--text)', outline: 'none', fontFamily: 'monospace' }} />

        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, textAlign: 'center' }}>
          🔑 邀请码由创作者发放 · 8位字符 · 10分钟内有效 · 一人一码
        </p>

        {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading || inviteCode.length !== 8}
          style={{ width: '100%', marginTop: 16, padding: '12px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            opacity: inviteCode.length === 8 ? 1 : 0.5 }}>
          {loading ? '验证中...' : '🎬 进入导演工作室'}
        </button>

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
