import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import { AGENT_MODES } from '../utils/nodeDefaults'

export const AgentNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [genLoading, setGenLoading] = useState(false)

  const agent = AGENT_MODES.find((a) => a.id === data.agentMode)
  const agentName = agent?.name || 'AI 智能体'

  const handleRun = async () => {
    if (!data.prompt) return
    setGenLoading(true)
    updateNodeData(id, { status: 'generating', response: '', errorMessage: '' })

    try {
      const { callAgentStream } = await import('../../../lib/api')
      let fullResponse = ''
      for await (const chunk of callAgentStream(data.prompt, data.agentMode)) {
        fullResponse += chunk
        updateNodeData(id, { response: fullResponse, status: 'generating' })
      }
      updateNodeData(id, { status: 'done' })
    } catch (e) {
      updateNodeData(id, { status: 'error', errorMessage: e.message })
    } finally {
      setGenLoading(false)
    }
  }

  return (
    <div className="canvas-node" style={{ minWidth: 280, maxWidth: 400 }}>
      <Handle type="target" position={Position.Left} id="prompt"
        style={{ background: 'var(--brand)', border: '2px solid var(--bg-surface)', width: 12, height: 12 }} />

      <div className="node-header" style={{ borderLeftColor: 'var(--brand)', gap: 6 }}>
        <span>{agentName}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
          {data.status === 'generating' ? '⏳' : data.status === 'done' ? '✅' : '⏸'}
        </span>
      </div>

      <div className="node-body" style={{ gap: 8 }}>
        {/* Agent selector */}
        <select
          value={data.agentMode}
          onChange={(e) => updateNodeData(id, { agentMode: e.target.value, response: '', status: 'idle' })}
          className="node-select"
        >
          {AGENT_MODES.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Prompt input */}
        <textarea
          value={data.prompt || ''}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder={agent ? `${agent.desc}` : '输入指令...'}
          rows={3}
          className="node-textarea"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Run button */}
        <button className="node-btn" onClick={handleRun}
          disabled={genLoading || !data.prompt}
          style={{
            background: 'var(--brand)', color: '#000',
            opacity: (genLoading || !data.prompt) ? 0.5 : 1,
          }}>
          {genLoading ? '⏳ 思考中...' : '▶ 运行'}
        </button>

        {/* Response */}
        {data.response && (
          <div style={{
            fontSize: 11, color: 'var(--text)', maxHeight: 180, overflowY: 'auto',
            background: 'var(--bg-root)', padding: 8, borderRadius: 6,
            lineHeight: 1.6, whiteSpace: 'pre-wrap',
          }}>
            {data.response.slice(0, 800)}
            {data.response.length > 800 && '...'}
          </div>
        )}

        {data.status === 'error' && (
          <div className="node-error">{data.errorMessage}</div>
        )}
      </div>

      <Handle type="source" position={Position.Right} id="output"
        style={{ background: 'var(--brand)', border: '2px solid var(--bg-surface)', width: 12, height: 12 }} />
    </div>
  )
})
