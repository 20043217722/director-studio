import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'

export const TextPromptNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  return (
    <div className="canvas-node" style={{ minWidth: 220, maxWidth: 320 }}>
      <div className="node-header" style={{ borderLeftColor: 'var(--accent-tts)' }}>
        <span>📝 {data.label}</span>
      </div>
      <div className="node-body">
        <textarea
          value={data.prompt || ''}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="输入提示词..."
          rows={4}
          className="node-textarea"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={handleStyle('var(--accent-tts)')}
      />
    </div>
  )
})

const handleStyle = (color) => ({
  background: color,
  border: '2px solid var(--bg-surface)',
  width: 12, height: 12,
})
