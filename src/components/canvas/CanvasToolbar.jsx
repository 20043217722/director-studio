import { useCanvasStore } from './utils/canvasStore'

const NODE_TYPES = [
  { type: 'textPrompt', label: '文本', icon: 'T' },
  { type: 'mediaGen', label: '生图', icon: 'M' },
  { type: 'reference', label: '参考', icon: 'R' },
  { type: 'agent', label: 'AI', icon: 'A' },
  { type: 'preview', label: '预览', icon: 'P' },
]

const MAX_NODES = 100

export function CanvasToolbar({ undo, redo, fitView, onSmartLayout }) {
  const { addNode, clearCanvas, exportCanvas, importCanvas, autoLayout, nodes } = useCanvasStore()
  const nodeCount = nodes.length

  const handleExport = () => {
    const json = JSON.stringify(exportCanvas(), null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'canvas_workflow.json'; a.click(); URL.revokeObjectURL(url)
  }
  const handleImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
    input.onchange = (e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { importCanvas(JSON.parse(reader.result)) } catch { alert('导入失败：JSON 格式无效') } }; reader.readAsText(file) }
    input.click()
  }

  return (
    <div className="canvas-toolbar">
      {NODE_TYPES.map((nt) => (
        <button key={nt.type} className="canvas-toolbar-btn" onClick={() => addNode(nt.type)}
          draggable onDragStart={(e) => { e.dataTransfer.setData('application/reactflow-type', nt.type); e.dataTransfer.effectAllowed = 'move' }}
          title={'添加' + nt.label}>{nt.icon}</button>
      ))}
      <div className="canvas-toolbar-divider" />
      <button className="canvas-toolbar-btn" onClick={undo} title="撤销 Ctrl+Z">撤</button>
      <button className="canvas-toolbar-btn" onClick={redo} title="重做 Ctrl+Y">重</button>
      <div className="canvas-toolbar-divider" />
      <button className="canvas-toolbar-btn" onClick={() => fitView({ duration: 300 })} title="适应画布">适</button>
      <button className="canvas-toolbar-btn" onClick={onSmartLayout || autoLayout} title="智能排列(沿数据流)">排</button>
      <div className="canvas-toolbar-divider" />
      <button className="canvas-toolbar-btn" onClick={handleExport} title="导出 JSON">导</button>
      <button className="canvas-toolbar-btn" onClick={handleImport} title="导入 JSON">入</button>
      <button className="canvas-toolbar-btn" onClick={() => { if (nodeCount === 0 || window.confirm('确定清空画布？')) clearCanvas() }}
        style={{ color: '#ef4444' }} title="清空画布">清</button>
      <div style={{ fontSize: 9, color: nodeCount >= MAX_NODES * 0.8 ? '#ef4444' : '#666', textAlign: 'center', fontWeight: 600, marginTop: 2 }}>
        {nodeCount}/{MAX_NODES}
      </div>
    </div>
  )
}
