import { useState, useCallback } from 'react'
import { useCanvasStore } from './utils/canvasStore'

const QUICK_STARTS = [
  {
    icon: '🖼️', label: '文生图', desc: '文本 → 图片生成 → 预览',
    nodes: [
      { type: 'textPrompt', position: { x: 80, y: 200 } },
      { type: 'imageGen', position: { x: 380, y: 180 } },
      { type: 'preview', position: { x: 720, y: 200 } },
    ],
    edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }],
  },
  {
    icon: '🎬', label: '图生视频', desc: '参考图 → 视频生成 → 预览',
    nodes: [
      { type: 'reference', position: { x: 80, y: 200 } },
      { type: 'videoGen', position: { x: 380, y: 180 } },
      { type: 'preview', position: { x: 720, y: 200 } },
    ],
    edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }],
  },
  {
    icon: '🧠', label: '多Agent协作', desc: '人物 → 场景 → 剧幕分析',
    nodes: [
      { type: 'textPrompt', position: { x: 60, y: 200 } },
      { type: 'agent', position: { x: 380, y: 40 }, data: { agentMode: 'character' } },
      { type: 'agent', position: { x: 380, y: 200 }, data: { agentMode: 'scene' } },
      { type: 'agent', position: { x: 380, y: 360 }, data: { agentMode: 'seedance' } },
      { type: 'preview', position: { x: 720, y: 200 } },
    ],
    edges: [{ source: 0, target: 1 }, { source: 0, target: 2 }, { source: 0, target: 3 },
      { source: 1, target: 4 }, { source: 2, target: 4 }, { source: 3, target: 4 }],
  },
  {
    icon: '📝', label: '文生视频', desc: '文本 → 视频生成 → 预览',
    nodes: [
      { type: 'textPrompt', position: { x: 80, y: 200 } },
      { type: 'videoGen', position: { x: 380, y: 180 } },
      { type: 'preview', position: { x: 720, y: 200 } },
    ],
    edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }],
  },
]

// Intent detection (shared with CanvasInputBar)
function detectIntent(text) {
  if (!text.trim()) return null
  if (/生成图|画.*图|文生图|配图|插图|海报|生成一张|^\/image/i.test(text)) return 'imageGen'
  if (/生成视频|做.*视频|文生视频|图生视频|短视频|^\/video/i.test(text)) return 'videoGen'
  if (/分析|设计角色|设计场景|帮我写|写.*剧本|^\/agent/i.test(text)) return 'agent'
  return 'imageGen'
}

export function CanvasWelcome() {
  const batchAddNodes = useCanvasStore((s) => s.batchAddNodes)
  const nodes = useCanvasStore((s) => s.nodes)
  const [nlInput, setNlInput] = useState('')

  const handleNlSubmit = useCallback(() => {
    if (!nlInput.trim()) return
    if (nodes.length > 0 && !window.confirm('画布已有节点，是否清空并应用此模板？')) return
    if (nodes.length > 0) useCanvasStore.getState().clearCanvas()

    const targetType = detectIntent(nlInput)
    // Create textPrompt + gen + preview chain
    useCanvasStore.getState().batchAddNodes({
      nodes: [
        { type: 'textPrompt', position: { x: 80, y: 200 } },
        { type: targetType, position: { x: 420, y: 180 } },
        { type: 'preview', position: { x: 760, y: 200 } },
      ],
      edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }],
    })
    // Then update the textPrompt node with the user's input
    setTimeout(() => {
      const s = useCanvasStore.getState()
      const textNode = s.nodes[s.nodes.length - 3]
      if (textNode && textNode.type === 'textPrompt') {
        s.updateNodeData(textNode.id, { prompt: nlInput.trim() })
      }
    }, 50)
    setNlInput('')
  }, [nlInput, nodes])

  const handleTemplate = (template) => {
    if (nodes.length > 0 && !window.confirm('画布已有节点，是否清空并应用此模板？')) return
    if (nodes.length > 0) useCanvasStore.getState().clearCanvas()
    batchAddNodes({ ...template })
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
      <div className="pointer-events-auto text-center p-8 rounded-2xl"
        style={{
          background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--glass-border)', maxWidth: 520,
        }}>
        <div style={{ fontSize: 40, marginBottom: 4 }}>♾️</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          无限画布
        </h2>

        {/* Natural language input */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 16,
          background: 'var(--bg-root)', borderRadius: 10, padding: '4px 6px',
          border: '1px solid var(--border)',
        }}>
          <input
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNlSubmit() }}
            placeholder="输入创作需求，Enter 一键搭建..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: 'var(--text)', padding: '8px 6px',
            }}
          />
          <button onClick={handleNlSubmit} disabled={!nlInput.trim()}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', opacity: nlInput.trim() ? 1 : 0.4,
              whiteSpace: 'nowrap',
            }}>
            ▶ 生成
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          或选择快速模板：
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {QUICK_STARTS.map((qs) => (
            <button key={qs.label} onClick={() => handleTemplate(qs)}
              style={{
                padding: '10px', borderRadius: 8, textAlign: 'left',
                border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                color: 'var(--text)', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.transform = '' }}
            >
              <div style={{ fontSize: 18, marginBottom: 2 }}>{qs.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{qs.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{qs.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14, fontSize: 10, color: 'var(--text-muted)' }}>
          💡 <kbd style={kbdStyle}>Ctrl+Z</kbd> 撤销 <kbd style={kbdStyle}>Del</kbd> 删除
          {' '}<kbd style={kbdStyle}>右键</kbd> 快速添加
        </div>
      </div>
    </div>
  )
}

const kbdStyle = {
  background: 'var(--bg-root)', border: '1px solid var(--border)',
  borderRadius: 3, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace',
}
