import { useState, useEffect, useRef } from 'react'
import { useCanvasStore } from './utils/canvasStore'

const NODE_TYPES = [
  { type: 'textPrompt', label: '📝 文本', color: 'var(--accent-tts)' },
  { type: 'mediaGen', label: '🎨 媒体生成', color: '#8b5cf6' },
  { type: 'imageGen', label: '🎨 生图', color: 'var(--accent-music)' },
  { type: 'videoGen', label: '🎬 生视频', color: 'var(--accent-sfx)' },
  { type: 'reference', label: '🖼️ 参考', color: 'var(--accent-clone)' },
  { type: 'preview', label: '👁️ 预览', color: 'var(--brand)' },
  { type: 'agent', label: '🧠 智能体', color: 'var(--brand)' },
  { type: 'pixelleVideo', label: '🎞️ 短视频', color: '#8b5cf6' },
]

const btnBase = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid transparent',
  fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
  background: 'transparent', color: 'var(--text-dim)',
}

const MAX_NODES = 100

export function CanvasToolbar({ undo, redo, fitView }) {
  const { addNode, clearCanvas, exportCanvas, importCanvas, autoLayout, nodes } = useCanvasStore()
  const [showAdd, setShowAdd] = useState(false)
  const dropdownRef = useRef(null)
  const nodeCount = nodes.length

  // Close dropdown on outside click
  useEffect(() => {
    if (!showAdd) return
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowAdd(false)
      }
    }
    setTimeout(() => document.addEventListener('click', close), 0)
    return () => document.removeEventListener('click', close)
  }, [showAdd])

  const handleExport = () => {
    const json = JSON.stringify(exportCanvas(), null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'canvas_workflow.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try { importCanvas(JSON.parse(reader.result)) }
        catch { alert('导入失败：JSON 格式无效') }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, display: 'flex', gap: 4, alignItems: 'center',
      background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
      border: '1px solid var(--glass-border)', borderRadius: 10, padding: '4px 8px',
    }}>
      {/* Add Node */}
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          ...btnBase, background: 'var(--accent, #0EA5E9)', color: '#fff', border: 'none',
          fontSize: 13, padding: '8px 18px',
        }}>+ 添加</button>
        {showAdd && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 4, minWidth: 150,
            boxShadow: 'var(--shadow-panel)', zIndex: 20,
          }}>
            {NODE_TYPES.map((nt) => (
              <button key={nt.type}
                onClick={() => { addNode(nt.type); setShowAdd(false) }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow-type', nt.type)
                  e.dataTransfer.effectAllowed = 'move'
                  setShowAdd(false)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', textAlign: 'left',
                  padding: '10px 14px', fontSize: 13, border: 'none', borderRadius: 6,
                  background: 'transparent', color: 'var(--text)', cursor: 'grab',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => { e.target.style.background = 'var(--bg-root)'; e.target.style.cursor = 'grab' }}
                onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.cursor = 'pointer' }}
              >
                <span style={{ fontSize: 16 }}>{nt.label.slice(0, 2)}</span>
                <span>{nt.label.slice(3)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

      {/* Undo / Redo */}
      <button onClick={undo} style={btnBase} title="撤销 (Ctrl+Z)"
        onMouseEnter={(e) => { e.target.style.background = 'var(--bg-root)'; e.target.style.color = 'var(--text)' }}
        onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-dim)' }}
      >↩</button>
      <button onClick={redo} style={btnBase} title="重做 (Ctrl+Y)"
        onMouseEnter={(e) => { e.target.style.background = 'var(--bg-root)'; e.target.style.color = 'var(--text)' }}
        onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-dim)' }}
      >↪</button>

      <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

      {/* Auto Layout */}
      <button onClick={autoLayout} style={btnBase} title="自动排列"
        onMouseEnter={(e) => { e.target.style.background = 'var(--bg-root)'; e.target.style.color = 'var(--text)' }}
        onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-dim)' }}
      >📐</button>

      {/* Fit View */}
      <button onClick={() => fitView({ duration: 300 })} style={btnBase} title="适应画布"
        onMouseEnter={(e) => { e.target.style.background = 'var(--bg-root)'; e.target.style.color = 'var(--text)' }}
        onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-dim)' }}
      >⊞</button>

      <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

      <button onClick={handleExport} style={btnBase} title="导出 JSON"
        onMouseEnter={(e) => { e.target.style.background = 'var(--bg-root)'; e.target.style.color = 'var(--text)' }}
        onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-dim)' }}
      >📥</button>
      <button onClick={handleImport} style={btnBase} title="导入 JSON"
        onMouseEnter={(e) => { e.target.style.background = 'var(--bg-root)'; e.target.style.color = 'var(--text)' }}
        onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-dim)' }}
      >📤</button>
      <button onClick={() => { if (nodeCount === 0 || window.confirm('清空画布？')) clearCanvas() }}
        style={{ ...btnBase, color: '#ef4444' }}
        onMouseEnter={(e) => e.target.style.background = 'rgba(239,68,68,0.08)'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
        title="清空画布">🗑</button>

      {/* Node count indicator */}
      <div style={{
        fontSize: 10, color: nodeCount >= MAX_NODES * 0.8 ? '#ef4444' : 'var(--text-muted)',
        fontWeight: 600, paddingLeft: 4,
      }} title={`${nodeCount}/${MAX_NODES} 节点`}>
        {nodeCount}/{MAX_NODES}
      </div>
    </div>
  )
}
