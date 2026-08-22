import { useState, useEffect, useCallback } from 'react'
import { getStats, getSummary, getLocalVisits, trackPageView } from '../lib/analytics'

export default function AdminDashboard({ onClose }) {
  const [stats, setStats] = useState({ total: '...', today: '...', activeUsers: '...' })
  const [local, setLocal] = useState(null)
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [s, l, v] = await Promise.all([
      getStats().catch(() => ({ total: 'E', today: 'E' })),
      Promise.resolve(getSummary()),
      Promise.resolve(getLocalVisits()),
    ])
    setStats(s)
    setLocal(l)
    setVisits(v.reverse())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleCopy = () => {
    const text = visits.map((v) => `${v.time} | ${v.visitorId} | ${v.language} | ${v.screenSize}`).join('\n')
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--bg-root)', overflow: 'auto',
      fontFamily: 'system-ui', padding: 40,
    }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
            📊 导演工作室 · 数据面板
          </h1>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
            color: 'var(--text)', fontSize: 13,
          }}>✕ 关闭</button>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard icon="👁️" label="总访问量" value={stats.total} color="var(--accent)" />
          <StatCard icon="📅" label="今日访问" value={stats.today} color="var(--accent-music)" />
          <StatCard icon="🟢" label="活跃用户" value={stats.activeUsers} color="var(--success)" />
          <StatCard icon="👤" label="独立访客" value={local?.uniqueVisitors ?? '...'} color="var(--accent-sfx)" />
        </div>

        {/* Local Stats */}
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 12, padding: 16,
          border: '1px solid var(--border)', marginBottom: 16,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
            📍 本地统计 (浏览器记录)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <StatRow label="总记录数" value={local?.totalRecorded ?? '...'} />
            <StatRow label="24h内" value={local?.last24h ?? '...'} />
            <StatRow label="1h内" value={local?.last1h ?? '...'} />
            <StatRow label="首次访问" value={local?.firstVisit ? new Date(local.firstVisit).toLocaleString() : '...'} />
            <StatRow label="最近访问" value={local?.lastVisit ? new Date(local.lastVisit).toLocaleString() : '...'} />
          </div>
        </div>

        {/* Visit Log */}
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 12, padding: 16,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              📜 访问记录 ({visits.length})
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCopy} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'transparent',
                cursor: 'pointer', color: 'var(--text)',
              }}>{copied ? '✅ 已复制' : '📋 复制'}</button>
              <button onClick={refresh} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'transparent',
                cursor: 'pointer', color: 'var(--text)',
              }}>{loading ? '⏳' : '🔄 刷新'}</button>
            </div>
          </div>
          <div style={{ maxHeight: 300, overflow: 'auto', fontSize: 11 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px' }}>时间</th>
                  <th style={{ padding: '4px 8px' }}>访客ID</th>
                  <th style={{ padding: '4px 8px' }}>语言</th>
                  <th style={{ padding: '4px 8px' }}>屏幕</th>
                </tr>
              </thead>
              <tbody>
                {visits.slice(0, 50).map((v, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 8px', color: 'var(--text)' }}>{new Date(v.time).toLocaleString()}</td>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{v.visitorId}</td>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{v.language}</td>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{v.screenSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
          数据存储在本地浏览器 localStorage + countapi.xyz 云端计数器
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)', borderRadius: 12, padding: 16,
      border: '1px solid var(--border)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
