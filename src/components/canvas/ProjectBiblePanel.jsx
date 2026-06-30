import { useState, useEffect, useCallback } from 'react'
import { getBible, updateBible, addCharacter, removeCharacter, addScene } from '../../lib/projectBible'

const PLATFORM_OPTIONS = [
  { id: 'seedance', label: '🎬 Seedance' },
  { id: 'kling', label: '🎥 可灵' },
  { id: 'runway', label: '🎞️ Runway' },
  { id: 'sora', label: '🌟 Sora' },
  { id: 'pika', label: '✨ Pika' },
  { id: 'wan', label: '🌊 万相' },
  { id: 'hailuo', label: '🌊 海螺' },
]

const ASPECT_OPTIONS = ['16:9', '9:16', '1:1', '2.39:1', '1.85:1', '4:3']

export function ProjectBiblePanel() {
  const [bible, setBible] = useState(getBible)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('info') // info | characters | scenes
  const [newChar, setNewChar] = useState({ name: '', description: '', visualAnchors: '' })
  const [newScene, setNewScene] = useState({ name: '', description: '', location: '', timeOfDay: '' })
  const [newRef, setNewRef] = useState({ title: '', director: '', year: '', notes: '' })

  // Subscribe to external changes
  useEffect(() => {
    const unsub = (window._bibleSub = () => setBible(getBible()))
    return () => { if (window._bibleSub === unsub) delete window._bibleSub }
  }, [])

  const handleUpdate = useCallback((patch) => {
    updateBible(patch)
    setBible(getBible())
  }, [])

  const handleAddRef = useCallback(() => {
    if (!newRef.title) return
    handleUpdate({ referenceFilms: [...(bible.referenceFilms || []), { ...newRef }] })
    setNewRef({ title: '', director: '', year: '', notes: '' })
  }, [newRef, bible.referenceFilms, handleUpdate])

  const handleRemoveRef = useCallback((idx) => {
    handleUpdate({ referenceFilms: bible.referenceFilms.filter((_, i) => i !== idx) })
  }, [bible.referenceFilms, handleUpdate])

  const handleAddChar = useCallback(() => {
    if (!newChar.name) return
    addCharacter(newChar)
    setBible(getBible())
    setNewChar({ name: '', description: '', visualAnchors: '' })
  }, [newChar])

  const handleAddScene = useCallback(() => {
    if (!newScene.name) return
    addScene(newScene)
    setBible(getBible())
    setNewScene({ name: '', description: '', location: '', timeOfDay: '' })
  }, [newScene])

  const togglePlatform = useCallback((pid) => {
    const current = bible.targetPlatforms || []
    const next = current.includes(pid) ? current.filter(p => p !== pid) : [...current, pid]
    handleUpdate({ targetPlatforms: next })
  }, [bible.targetPlatforms, handleUpdate])

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        title="项目圣经"
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 20,
          width: 36, height: 36, borderRadius: 8,
          border: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
          cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: bible.projectName ? 'var(--brand)' : 'var(--text-muted)',
          transition: 'all 0.2s',
        }}
      >
        📖
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 8, right: 50, zIndex: 19,
          width: 380, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
          background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--glass-border)', borderRadius: 12,
          padding: 14, boxShadow: 'var(--shadow-panel)',
          animation: 'fadeIn 0.15s ease',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>📖 项目圣经</span>
            <button onClick={() => setOpen(false)} style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 16,
            }}>✕</button>
          </div>

          {/* Tabs */}
          <div className="media-tabs" style={{ marginBottom: 10 }}>
            {['info', 'characters', 'scenes'].map(t => (
              <button key={t} className={`media-tab ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
                style={{ fontSize: 11, padding: '5px 8px' }}>
                {{ info: '📋 项目信息', characters: `👤 角色 (${bible.characterLibrary?.length || 0})`, scenes: `🏛️ 场景 (${bible.sceneLibrary?.length || 0})` }[t]}
              </button>
            ))}
          </div>

          {/* === Tab: Project Info === */}
          {tab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <BibleField label="项目名称">
                <input value={bible.projectName || ''}
                  onChange={e => handleUpdate({ projectName: e.target.value })}
                  className="config-input" placeholder="例如：雨夜咖啡馆" />
              </BibleField>

              <BibleField label="视觉风格">
                <input value={bible.visualStyle || ''}
                  onChange={e => handleUpdate({ visualStyle: e.target.value })}
                  className="config-input" placeholder="例如：王家卫式·低反差柔光·绿调偏色" />
              </BibleField>

              <BibleField label="色彩脚本">
                <textarea value={bible.colorScript || ''}
                  onChange={e => handleUpdate({ colorScript: e.target.value })}
                  rows={2} className="config-textarea"
                  placeholder="整体色彩策略：主色调+辅助色+情绪对应..." />
              </BibleField>

              <BibleField label="默认画幅比">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {ASPECT_OPTIONS.map(a => (
                    <button key={a} className="node-pill"
                      style={{
                        background: bible.defaultAspectRatio === a ? 'var(--accent-music)' : 'var(--bg-root)',
                        color: bible.defaultAspectRatio === a ? '#fff' : 'var(--text-dim)',
                      }}
                      onClick={() => handleUpdate({ defaultAspectRatio: a })}>{a}</button>
                  ))}
                </div>
              </BibleField>

              <BibleField label="目标平台">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {PLATFORM_OPTIONS.map(p => (
                    <button key={p.id} className="node-pill"
                      style={{
                        background: (bible.targetPlatforms || []).includes(p.id) ? 'var(--accent-music)' : 'var(--bg-root)',
                        color: (bible.targetPlatforms || []).includes(p.id) ? '#fff' : 'var(--text-dim)',
                      }}
                      onClick={() => togglePlatform(p.id)}>{p.label}</button>
                  ))}
                </div>
              </BibleField>

              {/* Reference Films */}
              <BibleField label="参考影片">
                {(bible.referenceFilms || []).map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4,
                    padding: '4px 6px', borderRadius: 4, background: 'var(--bg-root)', fontSize: 11 }}>
                    <span style={{ flex: 1 }}>🎬 {r.title} ({r.director}·{r.year}){r.notes ? ` — ${r.notes}` : ''}</span>
                    <button onClick={() => handleRemoveRef(i)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 4 }}>
                  <input value={newRef.title} onChange={e => setNewRef({ ...newRef, title: e.target.value })}
                    placeholder="片名" className="config-input" style={{ flex: 2, padding: '4px 6px', fontSize: 11 }} />
                  <input value={newRef.director} onChange={e => setNewRef({ ...newRef, director: e.target.value })}
                    placeholder="导演" className="config-input" style={{ flex: 2, padding: '4px 6px', fontSize: 11 }} />
                  <input value={newRef.year} onChange={e => setNewRef({ ...newRef, year: e.target.value })}
                    placeholder="年份" className="config-input" style={{ flex: 1, padding: '4px 6px', fontSize: 11 }} />
                  <button onClick={handleAddRef} disabled={!newRef.title}
                    style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: 'none',
                      background: 'var(--accent-music)', color: '#fff', cursor: 'pointer' }}>+</button>
                </div>
              </BibleField>
            </div>
          )}

          {/* === Tab: Characters === */}
          {tab === 'characters' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(bible.characterLibrary || []).map((c, i) => (
                <div key={i} style={{ padding: 8, borderRadius: 6, background: 'var(--bg-root)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>👤 {c.name}</span>
                    <button onClick={() => { removeCharacter(c.name); setBible(getBible()) }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                  </div>
                  {c.description && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{c.description}</div>}
                  {c.visualAnchors && <div style={{ fontSize: 10, color: 'var(--accent-music)', marginTop: 2 }}>锚点: {c.visualAnchors}</div>}
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4,
                padding: 8, borderRadius: 6, border: '1px dashed var(--border)' }}>
                <input value={newChar.name} onChange={e => setNewChar({ ...newChar, name: e.target.value })}
                  placeholder="角色名" className="config-input" style={{ padding: '4px 6px', fontSize: 11 }} />
                <input value={newChar.description} onChange={e => setNewChar({ ...newChar, description: e.target.value })}
                  placeholder="描述" className="config-input" style={{ padding: '4px 6px', fontSize: 11 }} />
                <input value={newChar.visualAnchors} onChange={e => setNewChar({ ...newChar, visualAnchors: e.target.value })}
                  placeholder="视觉锚点" className="config-input" style={{ padding: '4px 6px', fontSize: 11 }} />
                <button onClick={handleAddChar} disabled={!newChar.name}
                  style={{ padding: '5px', fontSize: 11, borderRadius: 4, border: 'none',
                    background: 'var(--accent-music)', color: '#fff', cursor: 'pointer' }}>添加角色</button>
              </div>
            </div>
          )}

          {/* === Tab: Scenes === */}
          {tab === 'scenes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(bible.sceneLibrary || []).map((s, i) => (
                <div key={i} style={{ padding: 8, borderRadius: 6, background: 'var(--bg-root)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>🏛️ {s.name}</div>
                  {s.description && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{s.description}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {s.location}{s.timeOfDay ? ` · ${s.timeOfDay}` : ''}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4,
                padding: 8, borderRadius: 6, border: '1px dashed var(--border)' }}>
                <input value={newScene.name} onChange={e => setNewScene({ ...newScene, name: e.target.value })}
                  placeholder="场景名" className="config-input" style={{ padding: '4px 6px', fontSize: 11 }} />
                <input value={newScene.description} onChange={e => setNewScene({ ...newScene, description: e.target.value })}
                  placeholder="描述" className="config-input" style={{ padding: '4px 6px', fontSize: 11 }} />
                <div style={{ display: 'flex', gap: 4 }}>
                  <input value={newScene.location} onChange={e => setNewScene({ ...newScene, location: e.target.value })}
                    placeholder="地点" className="config-input" style={{ flex: 1, padding: '4px 6px', fontSize: 11 }} />
                  <input value={newScene.timeOfDay} onChange={e => setNewScene({ ...newScene, timeOfDay: e.target.value })}
                    placeholder="时间" className="config-input" style={{ flex: 1, padding: '4px 6px', fontSize: 11 }} />
                </div>
                <button onClick={handleAddScene} disabled={!newScene.name}
                  style={{ padding: '5px', fontSize: 11, borderRadius: 4, border: 'none',
                    background: 'var(--accent-music)', color: '#fff', cursor: 'pointer' }}>添加场景</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function BibleField({ label, children }) {
  return (
    <div>
      <div className="config-label" style={{ fontSize: 9 }}>{label}</div>
      {children}
    </div>
  )
}
