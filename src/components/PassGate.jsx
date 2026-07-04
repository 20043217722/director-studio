import { useState, useRef, useEffect } from 'react'

const PASSCODE = 'aqiu1234567890'
const API = 'http://localhost:3001'

export default function PassGate({ onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Track visit attempt
  useEffect(() => {
    fetch(`${API}/api/auth/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 'login' }),
    }).catch(() => {})
  }, [])

  function handleSubmit() {
    if (code === PASSCODE) {
      sessionStorage.setItem('ds_pass', '1')
      onUnlock()
    } else {
      setError('邀请码错误')
      setCode('')
      inputRef.current?.focus()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg-root)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 360, padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>导演工作室</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>输入邀请码进入</p>

        <input ref={inputRef} type="password" value={code}
          onChange={e => { setCode(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          placeholder="输入邀请码"
          autoFocus
          style={{ width: '100%', padding: '12px 16px', fontSize: 16, borderRadius: 10,
            border: error ? '2px solid #ef4444' : '1px solid var(--border)',
            background: 'var(--bg-input)', color: 'var(--text)', outline: 'none',
            fontFamily: 'inherit', textAlign: 'center', letterSpacing: 2 }} />

        {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{error}</div>}

        <button onClick={handleSubmit}
          style={{ width: '100%', marginTop: 16, padding: '12px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          进入
        </button>

        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 16 }}>创作者发放的邀请码即可使用</p>
      </div>
    </div>
  )
}
