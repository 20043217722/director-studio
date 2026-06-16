import { useCanvasStore } from './utils/canvasStore'

const QUICK_STARTS = [
  {
    icon: '🖼️', label: '文生图', desc: '文本 → DALL·E/SD → 预览',
    layout: () => {
      const s = useCanvasStore.getState()
      s.addNode('textPrompt', { x: 80, y: 200 })
      s.addNode('imageGen', { x: 380, y: 180 })
      s.addNode('preview', { x: 720, y: 200 })
    },
  },
  {
    icon: '🎬', label: '图生视频', desc: '参考图 → Seedance/可灵 → 预览',
    layout: () => {
      const s = useCanvasStore.getState()
      s.addNode('reference', { x: 80, y: 200 })
      s.addNode('videoGen', { x: 380, y: 180 })
      s.addNode('preview', { x: 720, y: 200 })
    },
  },
  {
    icon: '🧠', label: '多Agent协作', desc: '人物造型 → 场景设计 → 剧幕分析',
    layout: () => {
      const s = useCanvasStore.getState()
      s.addNode('textPrompt', { x: 60, y: 80 })
      s.addNode('agent', { x: 360, y: 60 })
      s.addNode('agent', { x: 360, y: 200 })
      s.addNode('agent', { x: 360, y: 340 })
      s.addNode('preview', { x: 700, y: 200 })
    },
  },
  {
    icon: '📝', label: '文生视频', desc: '文本 → 可灵/Wan → 预览',
    layout: () => {
      const s = useCanvasStore.getState()
      s.addNode('textPrompt', { x: 80, y: 200 })
      s.addNode('videoGen', { x: 380, y: 180 })
      s.addNode('preview', { x: 720, y: 200 })
    },
  },
]

export function CanvasWelcome() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
      <div className="pointer-events-auto text-center p-8 rounded-2xl"
        style={{
          background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--glass-border)', maxWidth: 480,
        }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>♾️</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          无限画布
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          拖拽节点 · 连线搭建 · 多模型聚合 · 实时预览
          <br />从工具栏 + 添加 开始，或选择快速模板：
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {QUICK_STARTS.map((qs) => (
            <button key={qs.label} onClick={qs.layout}
              style={{
                padding: '12px', borderRadius: 10, textAlign: 'left',
                border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                color: 'var(--text)', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.transform = '' }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{qs.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{qs.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{qs.desc}</div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-muted)' }}>
          💡 快捷键: <kbd style={kbdStyle}>Ctrl+Z</kbd> 撤销 <kbd style={kbdStyle}>Ctrl+Y</kbd> 重做
          {' '}<kbd style={kbdStyle}>Delete</kbd> 删除 {' '}<kbd style={kbdStyle}>Shift+拖拽</kbd> 框选
        </div>
      </div>
    </div>
  )
}

const kbdStyle = {
  background: 'var(--bg-root)', border: '1px solid var(--border)',
  borderRadius: 3, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace',
}
