import { useState, useCallback } from 'react'
import { useCanvasStore } from './utils/canvasStore'

const QUICK_STARTS = [
  { icon: 'IMG', label: 'Text to Image', desc: 'Text -> Image Gen -> Preview',
    nodes: [ { type: 'textPrompt', position: { x: 80, y: 200 } },
             { type: 'mediaGen', position: { x: 380, y: 180 }, data: { mediaType: 'image' } },
             { type: 'preview', position: { x: 720, y: 200 } } ],
    edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }] },
  { icon: 'VID', label: 'Image to Video', desc: 'Reference -> Video Gen -> Preview',
    nodes: [ { type: 'reference', position: { x: 80, y: 200 } },
             { type: 'mediaGen', position: { x: 380, y: 180 }, data: { mediaType: 'video' } },
             { type: 'preview', position: { x: 720, y: 200 } } ],
    edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }] },
  { icon: 'AI', label: 'Multi-Agent', desc: 'Text -> Agents -> Preview',
    nodes: [ { type: 'textPrompt', position: { x: 60, y: 200 } },
             { type: 'agent', position: { x: 380, y: 40 }, data: { agentMode: 'character' } },
             { type: 'agent', position: { x: 380, y: 200 }, data: { agentMode: 'scene' } },
             { type: 'preview', position: { x: 720, y: 200 } } ],
    edges: [{ source: 0, target: 1 }, { source: 0, target: 2 }, { source: 1, target: 3 }, { source: 2, target: 3 }] },
  { icon: 'TXT', label: 'Text to Video', desc: 'Text -> Video Gen -> Preview',
    nodes: [ { type: 'textPrompt', position: { x: 80, y: 200 } },
             { type: 'mediaGen', position: { x: 380, y: 180 }, data: { mediaType: 'video' } },
             { type: 'preview', position: { x: 720, y: 200 } } ],
    edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }] },
]

export function CanvasWelcome() {
  const batchAddNodes = useCanvasStore((s) => s.batchAddNodes)
  const nodes = useCanvasStore((s) => s.nodes)
  const [nlInput, setNlInput] = useState('')

  const handleNlSubmit = useCallback(() => {
    if (!nlInput.trim()) return
    if (nodes.length > 0 && !window.confirm('Canvas has existing nodes. Clear and apply template?')) return
    if (nodes.length > 0) useCanvasStore.getState().clearCanvas()
    const s = useCanvasStore.getState()
    const beforeCount = s.nodes.length
    s.batchAddNodes({
      nodes: [
        { type: 'textPrompt', position: { x: 80, y: 200 } },
        { type: 'mediaGen', position: { x: 420, y: 180 }, data: { mediaType: 'image' } },
        { type: 'preview', position: { x: 760, y: 200 } },
      ],
      edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }],
    })
    const afterNodes = s.nodes
    for (let i = beforeCount; i < afterNodes.length; i++) {
      if (afterNodes[i].type === 'textPrompt') { s.updateNodeData(afterNodes[i].id, { prompt: nlInput.trim() }); break }
    }
    setNlInput('')
  }, [nlInput, nodes])

  const handleTemplate = (template) => {
    if (nodes.length > 0 && !window.confirm('Canvas has existing nodes. Clear and apply template?')) return
    if (nodes.length > 0) useCanvasStore.getState().clearCanvas()
    batchAddNodes({ ...template })
  }

  return (
    <div className="canvas-welcome">
      <div className="canvas-welcome-card">
        <div style={{ fontSize: 32, marginBottom: 8 }}>+</div>
        <h2 style={{fontSize:18,fontWeight:700,color:'#e0e0f0',marginBottom:6}}>Infinite Canvas</h2>

        <div className="canvas-welcome-input">
          <input value={nlInput} onChange={(e) => setNlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNlSubmit() }}
            placeholder="Describe your creative idea, Enter to build..." />
          <button onClick={handleNlSubmit} disabled={!nlInput.trim()}>Build</button>
        </div>

        <p style={{fontSize:10,color:'#666',marginBottom:10}}>or choose a quick template:</p>

        <div className="canvas-welcome-templates">
          {QUICK_STARTS.map((qs) => (
            <button key={qs.label} onClick={() => handleTemplate(qs)} className="canvas-welcome-tpl">
              <div className="tpl-icon">{qs.icon}</div>
              <div className="tpl-name">{qs.label}</div>
              <div className="tpl-desc">{qs.desc}</div>
            </button>
          ))}
        </div>

        <div style={{marginTop:12,fontSize:10,color:'#555'}}>
          Ctrl+Z Undo | Del Delete | Right-click Add
        </div>
      </div>
    </div>
  )
}
