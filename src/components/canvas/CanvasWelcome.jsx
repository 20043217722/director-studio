import { useState, useCallback } from 'react'
import { useCanvasStore } from './utils/canvasStore'

const QUICK_STARTS = [
  { icon: '图', label: '文生图', desc: '文本 -> 图片生成 -> 预览',
    nodes: [ { type: 'textPrompt', position: { x: 80, y: 200 } }, { type: 'mediaGen', position: { x: 380, y: 180 }, data: { mediaType: 'image' } }, { type: 'preview', position: { x: 720, y: 200 } } ],
    edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }] },
  { icon: '视', label: '图生视频', desc: '参考图 -> 视频生成 -> 预览',
    nodes: [ { type: 'reference', position: { x: 80, y: 200 } }, { type: 'mediaGen', position: { x: 380, y: 180 }, data: { mediaType: 'video' } }, { type: 'preview', position: { x: 720, y: 200 } } ],
    edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }] },
  { icon: 'AI', label: '多Agent协作', desc: '文本 -> 人物 + 场景 -> 预览',
    nodes: [ { type: 'textPrompt', position: { x: 60, y: 200 } }, { type: 'agent', position: { x: 380, y: 40 }, data: { agentMode: 'character' } }, { type: 'agent', position: { x: 380, y: 200 }, data: { agentMode: 'scene' } }, { type: 'preview', position: { x: 720, y: 200 } } ],
    edges: [{ source: 0, target: 1 }, { source: 0, target: 2 }, { source: 1, target: 3 }, { source: 2, target: 3 }] },
  { icon: '文', label: '文生视频', desc: '文本 -> 视频生成 -> 预览',
    nodes: [ { type: 'textPrompt', position: { x: 80, y: 200 } }, { type: 'mediaGen', position: { x: 380, y: 180 }, data: { mediaType: 'video' } }, { type: 'preview', position: { x: 720, y: 200 } } ],
    edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }] },
]

export function CanvasWelcome() {
  const batchAddNodes = useCanvasStore((s) => s.batchAddNodes)
  const nodes = useCanvasStore((s) => s.nodes)
  const [input, setInput] = useState('')

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return
    if (nodes.length > 0 && !window.confirm('画布已有节点，是否清空并应用此模板？')) return
    if (nodes.length > 0) useCanvasStore.getState().clearCanvas()
    const s = useCanvasStore.getState(); const before = s.nodes.length
    s.batchAddNodes({ nodes: [ { type: 'textPrompt', position: { x: 80, y: 200 } }, { type: 'mediaGen', position: { x: 420, y: 180 }, data: { mediaType: 'image' } }, { type: 'preview', position: { x: 760, y: 200 } } ], edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }] })
    const after = s.nodes; for (let i = before; i < after.length; i++) { if (after[i].type === 'textPrompt') { s.updateNodeData(after[i].id, { prompt: input.trim() }); break } }
    setInput('')
  }, [input, nodes])

  const handleTemplate = (template) => {
    if (nodes.length > 0 && !window.confirm('画布已有节点，是否清空并应用此模板？')) return
    if (nodes.length > 0) useCanvasStore.getState().clearCanvas()
    batchAddNodes({ ...template })
  }

  return (
    <div className="canvas-welcome">
      <div className="canvas-welcome-card">
        <div style={{ fontSize: 32, marginBottom: 8 }}>无限画布</div>
        <h2 style={{fontSize:18,fontWeight:700,color:'#e0e0f0',marginBottom:6}}>节点式 AI 工作流</h2>
        <div className="canvas-welcome-input">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            placeholder="输入创作需求，Enter 一键搭建..." />
          <button onClick={handleSubmit} disabled={!input.trim()}>生成</button>
        </div>
        <p style={{fontSize:10,color:'#666',marginBottom:10}}>或选择快速模板：</p>
        <div className="canvas-welcome-templates">
          {QUICK_STARTS.map((qs) => (
            <button key={qs.label} onClick={() => handleTemplate(qs)} className="canvas-welcome-tpl">
              <div className="tpl-icon">{qs.icon}</div>
              <div className="tpl-name">{qs.label}</div>
              <div className="tpl-desc">{qs.desc}</div>
            </button>
          ))}
        </div>
        <div style={{marginTop:12,fontSize:10,color:'#555'}}>Ctrl+Z 撤销 | Del 删除 | 右键 快速添加</div>
      </div>
    </div>
  )
}
