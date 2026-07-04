import { useState, useEffect } from 'react'

/**
 * Password gate for admin panel.
 * On first access: set a password.
 * On subsequent access: enter password to unlock.
 * Password hash stored in localStorage (browser-local, not shared).
 */
export default function AdminGate({ onUnlock }) {
  const [step, setStep] = useState('check') // 'check' | 'set' | 'enter'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    const storedHash = localStorage.getItem('ds_admin_hash')
    if (!storedHash) {
      setStep('set')
    }
  }, [])

  async function hashPassword(pw) {
    const encoder = new TextEncoder()
    const data = encoder.encode('director-studio-admin-' + pw)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  async function handleSet() {
    if (password.length < 4) {
      setError('密码至少4位')
      setShaking(true); setTimeout(() => setShaking(false), 400)
      return
    }
    const hash = await hashPassword(password)
    localStorage.setItem('ds_admin_hash', hash)
    localStorage.setItem('ds_admin_raw', password) // for API calls
    setPassword('')
    setError('')
    onUnlock()
  }

  async function handleEnter() {
    const storedHash = localStorage.getItem('ds_admin_hash')
    const hash = await hashPassword(password)
    if (hash === storedHash) {
      setPassword('')
      setError('')
      onUnlock()
    } else {
      setError('密码错误')
      setShaking(true); setTimeout(() => setShaking(false), 400)
    }
  }

  function handleReset() {
    localStorage.removeItem('ds_admin_hash')
    setStep('set')
    setPassword('')
    setError('')
  }

  const handleSubmit = step === 'set' ? handleSet : handleEnter

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 250,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 14,
        padding: 32, minWidth: 300, maxWidth: 380,
        border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: shaking ? 'shake 0.4s ease' : 'fadeIn 0.2s ease',
      }}>
        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🔐</div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', textAlign: 'center', marginBottom: 8 }}>
          {step === 'set' ? '设置管理密码' : '管理员验证'}
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16 }}>
          {step === 'set'
            ? '首次访问，请设置一个密码来保护数据面板'
            : '请输入密码查看数据面板'}
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          placeholder={step === 'set' ? '设置密码 (至少4位)...' : '输入密码...'}
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14,
            borderRadius: 8, border: error ? '2px solid #ef4444' : '1px solid var(--border)',
            background: 'var(--bg-input)', color: 'var(--text)', outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        {error && (
          <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{error}</div>
        )}

        <button onClick={handleSubmit}
          style={{
            width: '100%', marginTop: 16, padding: '10px',
            background: 'var(--accent, #0EA5E9)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}>
          {step === 'set' ? '🔒 设置并进入' : '🔓 解锁'}
        </button>

        {step === 'enter' && (
          <button onClick={handleReset}
            style={{
              width: '100%', marginTop: 8, padding: '6px',
              background: 'transparent', color: 'var(--text-muted)',
              border: 'none', fontSize: 11, cursor: 'pointer',
            }}>
            忘记密码？点击重置
          </button>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-6px); }
          40%,80% { transform: translateX(6px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
