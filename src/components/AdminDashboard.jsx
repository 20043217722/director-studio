import { useState, useEffect, useCallback } from 'react'

const API = 'http://localhost:3001'

// Get admin password from localStorage (set via AdminGate)
function getAdminAuth() { return localStorage.getItem('ds_admin_raw') || 'admin123' }

export default function AdminDashboard({ onClose }) {
  const [tab, setTab] = useState('codes') // 'codes' | 'stats'
  const [codes, setCodes] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genCount, setGenCount] = useState(1)
  const [copied, setCopied] = useState(null)

  const fetchCodes = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/auth/codes`, { headers: { 'x-admin-auth': getAdminAuth() } })
      if (r.ok) setCodes((await r.json()).codes || [])
    } catch { /* backend not running */ }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/stats`, { headers: { 'x-admin-auth': getAdminAuth() } })
      if (r.ok) setStats(await r.json())
    } catch { /* backend not running */ }
  }, [])

  useEffect(() => { fetchCodes(); fetchStats(); setLoading(false) }, [fetchCodes, fetchStats])

  const generateCodes = async () => {
    setGenerating(true)
    try {
      const r = await fetch(`${API}/api/auth/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-auth': getAdminAuth() },
        body: JSON.stringify({ count: genCount }),
      })
      if (r.ok) {
        const d = await r.json()
        setCodes(prev => [...d.codes, ...prev])
        await fetchCodes()
      }
    } catch { /* */ }
    setGenerating(false)
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => { setCopied(code); setTimeout(() => setCopied(null), 1500) })
  }

  const copyAllActive = () => {
    const active = codes.filter(c => !c.is_used && !c.is_expired).map(c => c.code).join('\n')
    navigator.clipboard.writeText(active).then(() => { setCopied('all'); setTimeout(() => setCopied(null), 1500) })
  }

  const status = (c) => {
    if (c.is_used) return { text: '已使用', color: '#f97316' }
    if (c.is_expired) return { text: '已过期', color: '#6b7280' }
    return { text: '可用', color: '#10b981' }
  }

  const activeCodes = codes.filter(c => !c.is_used && !c.is_expired)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg-root)', overflow: 'auto', padding: 40 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>📊 管理面板</h1>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }}>✕ 关闭</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {[
            { id: 'codes', label: '🔑 邀请码', badge: activeCodes.length },
            { id: 'stats', label: '📈 用户统计', badge: stats?.total_visits },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent' }}>
              {t.label} {t.badge != null && <span style={{ fontSize: 11, opacity: 0.6 }}>({t.badge})</span>}
            </button>
          ))}
        </div>

        {tab === 'codes' && (
          <>
            {/* Generate Panel */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>🔑 生成邀请码</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                生成8位随机邀请码，有效期10分钟，一人一码，用过即失效。生成后复制发给用户。
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select value={genCount} onChange={e => setGenCount(Number(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}>
                  {[1,2,3,5,10,20].map(n => <option key={n} value={n}>{n} 个</option>)}
                </select>
                <button onClick={generateCodes} disabled={generating}
                  style={{ padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none',
                    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {generating ? '生成中...' : '🎲 生成邀请码'}
                </button>
                {activeCodes.length > 0 && (
                  <button onClick={copyAllActive}
                    style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: 8, fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}>
                    {copied === 'all' ? '✅ 已复制' : '📋 复制全部可用'}
                  </button>
                )}
              </div>
            </div>

            {/* Code List */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                📋 邀请码列表 ({codes.length}) — 可用 {activeCodes.length} | 已用 {codes.filter(c=>c.is_used).length} | 过期 {codes.filter(c=>c.is_expired).length}
              </h3>
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px' }}>邀请码</th>
                      <th style={{ padding: '8px' }}>状态</th>
                      <th style={{ padding: '8px' }}>生成时间</th>
                      <th style={{ padding: '8px' }}>过期时间</th>
                      <th style={{ padding: '8px' }}>使用者</th>
                      <th style={{ padding: '8px' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((c, i) => {
                      const s = status(c)
                      const expiredAt = new Date(c.expires_at)
                      const remaining = !c.is_used && !c.is_expired ? Math.max(0, Math.floor((expiredAt - Date.now()) / 60000)) : null
                      return (
                        <tr key={i} style={{ borderTop: '1px solid var(--border)', opacity: c.is_used || c.is_expired ? 0.5 : 1 }}>
                          <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>
                            {c.code}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span style={{ color: s.color, fontWeight: 600, fontSize: 12 }}>
                              {s.text}{remaining != null ? ` (${remaining}分钟)` : ''}
                            </span>
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)', fontSize: 11 }}>
                            {new Date(c.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)', fontSize: 11 }}>
                            {new Date(c.expires_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)', fontSize: 11 }}>
                            {c.used_by ? c.used_by.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '-'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            {!c.is_used && !c.is_expired && (
                              <button onClick={() => copyCode(c.code)}
                                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
                                  background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}>
                                {copied === c.code ? '✅' : '📋'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {codes.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>暂无邀请码，点击上方生成</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'stats' && stats && (
          <>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
              <StatCard icon="👥" label="总用户数" value={stats.total_users} color="var(--accent)" />
              <StatCard icon="👁️" label="总访问量" value={stats.total_visits} color="var(--accent-music)" />
              <StatCard icon="🔑" label="可用邀请码" value={stats.codes_active} color="#10b981" />
              <StatCard icon="✅" label="已用邀请码" value={stats.codes_used} color="#f97316" />
              <StatCard icon="📅" label="今日访问" value={stats.today_visits} color="var(--accent-sfx)" />
              <StatCard icon="🆕" label="今日新用户" value={stats.today_users} color="var(--accent-clone)" />
            </div>

            {/* Daily chart */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>📈 最近7天</h3>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120 }}>
                {stats.days?.map((d, i) => {
                  const max = Math.max(...stats.days.map(x => x.visits), 1)
                  const h = Math.max(4, (d.visits / max) * 100)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text)', fontWeight: 600 }}>{d.visits}</span>
                      <div style={{ width: '100%', maxWidth: 40, height: h, background: 'var(--accent)', borderRadius: '4px 4px 0 0', opacity: 0.7, minHeight: 4 }} />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d.date.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent visits */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>📜 最近访问</h3>
              <div style={{ maxHeight: 250, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '4px 8px' }}>时间</th>
                      <th style={{ padding: '4px 8px' }}>手机号</th>
                      <th style={{ padding: '4px 8px' }}>页面</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.recent_visits || []).map((v, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '4px 8px', color: 'var(--text)' }}>{new Date(v.time).toLocaleString()}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{v.phone === 'anon' ? '未登录' : v.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{v.page}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'stats' && !stats && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            {loading ? '加载中...' : '无法连接后端，请确保 server.cjs 已启动 (localhost:3001)'}
          </div>
        )}

        <div style={{ marginTop: 24, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
          数据存储在 backend/data/ 目录 · 后端需运行 localhost:3001
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', textAlign: 'center' }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value ?? '...'}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  )
}
