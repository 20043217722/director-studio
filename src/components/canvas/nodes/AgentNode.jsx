import { memo, useState, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import { AGENT_MODES } from '../utils/nodeDefaults'

export const AgentNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const registerAbort = useCanvasStore((s) => s.registerAbort)
  const unregisterAbort = useCanvasStore((s) => s.unregisterAbort)
  const [genLoading, setGenLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const agent = AGENT_MODES.find((a) => a.id === (data.agentMode || 'director'))
  const agentName = agent?.name || 'AI 智能体'
  const hasResponse = !!data.response

  const handleCancel = useCallback(() => {
    useCanvasStore.getState().abortGeneration(id)
    setGenLoading(false)
    updateNodeData(id, { status: 'idle', errorMessage: '' })
  }, [id, updateNodeData])

  const handleRun = async () => {
    if (!data.prompt) return
    setGenLoading(true)
    updateNodeData(id, { status: 'generating', response: '', errorMessage: '' })
    const ctrl = new AbortController()
    registerAbort(id, ctrl)
    try {
      const { callAgentStream } = await import('../../../lib/api')
      const promptWithLang = data.prompt && !/中文|Chinese|用中文|请用中文/.test(data.prompt)
        ? `请用中文回答：\n${data.prompt}` : data.prompt
      // Vision support: auto-detect best vision model, support multi-image
      const apiOpts = { signal: ctrl.signal }
      if (data.sourceImage) {
        // Single image (backwards compat) or multiple images from different refs
        if (data.sourceImages?.length > 1) {
          apiOpts.imageBase64s = data.sourceImages.map((img) => img.data)
          apiOpts.imageMimes = data.sourceImages.map((img) => img.type === 'video' ? 'video/mp4' : 'image/jpeg')
        } else {
          apiOpts.imageBase64 = data.sourceImage
          apiOpts.imageMime = 'image/jpeg'
        }
        // Priority: Agnes (free) → Qwen → OpenAI → Gemini
        const keys = JSON.parse(localStorage.getItem('api_keys') || '{}')
        const visionPriority = ['agnes', 'qwen', 'openai', 'gemini']
        const bestVision = visionPriority.find((p) => keys[p])
        if (bestVision) apiOpts.provider = bestVision
      }
      let fullResponse = ''
      for await (const chunk of callAgentStream(promptWithLang, data.agentMode || 'director', apiOpts)) {
        if (ctrl.signal.aborted) return
        fullResponse += chunk
        updateNodeData(id, { response: fullResponse, status: 'generating' })
      }
      if (ctrl.signal.aborted) return
      // Auto-fill prompt textarea with response for immediate editing
      updateNodeData(id, { status: 'done', prompt: fullResponse })
    } catch (e) {
      if (e.name === 'AbortError' || ctrl.signal.aborted) return
      updateNodeData(id, { status: 'error', errorMessage: e.message })
    } finally { setGenLoading(false); unregisterAbort(id) }
  }

  const handleCopy = () => {
    if (!data.response) return
    navigator.clipboard.writeText(data.response).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <div className="canvas-node agent-node" style={{ minWidth: 280, maxWidth: 420 }}>
      <Handle type="target" position={Position.Left} id="prompt"
        style={{ background: 'var(--brand)', border: '2px solid var(--bg-surface)', width: 14, height: 14 }} />

      {/* Header */}
      <div className="node-header" style={{ borderLeftColor: 'var(--brand)' }}>
        <span>{agentName}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color:
          data.status === 'done' ? 'var(--success)' :
          data.status === 'error' ? '#ef4444' :
          data.status === 'generating' ? 'var(--brand)' : 'var(--text-muted)' }}>
          {data.status === 'generating' ? '⏳' : data.status === 'done' ? '✅' : data.status === 'error' ? '❌' : '⏸'}
        </span>
      </div>

      <div className="node-body">
        {/* Agent picker — compact pill row */}
        <select value={data.agentMode || 'director'}
          onChange={(e) => updateNodeData(id, { agentMode: e.target.value, response: '', status: 'idle' })}
          className="node-select">
          {AGENT_MODES.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>

        {/* Prompt input */}
        <textarea
          value={data.prompt || ''}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder={agent ? agent.desc : '输入指令...'}
          rows={3} className="node-textarea"
          onClick={(e) => e.stopPropagation()}
          style={{ userSelect: 'text' }}
        />

        {/* Run / Cancel */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="node-btn node-btn-primary"
            onClick={handleRun} disabled={genLoading || !data.prompt}
            style={{ flex: 1, background: 'var(--brand)', color: '#fff' }}>
            {genLoading ? '⏳ 思考中...' : '▶ 运行'}
          </button>
          {genLoading && <button className="node-btn node-btn-danger" onClick={handleCancel}
            style={{ background: '#ef4444', color: '#fff' }}>✕</button>}
        </div>

        {/* Response — selectable + copyable */}
        {hasResponse && (
          <div className="agent-response">
            <div className="response-toolbar">
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {data.response.length} 字
              </span>
              <button onClick={handleCopy} style={{
                fontSize: 11, background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 4, padding: '2px 8px', cursor: 'pointer', color: 'var(--text)',
              }}>{copied ? '✅ 已复制' : '📋 复制'}</button>
            </div>
            <div className="response-text" style={{ userSelect: 'text', whiteSpace: 'pre-wrap',
              fontSize: 12, lineHeight: 1.7, maxHeight: 220, overflowY: 'auto',
              padding: 10, background: 'var(--bg-root)', borderRadius: 6 }}>
              {data.response.slice(0, 2000)}
              {data.response.length > 2000 && <span style={{ color: 'var(--text-muted)' }}>... (截断)</span>}
            </div>
          </div>
        )}

        {data.status === 'error' && <div className="node-error">{data.errorMessage}</div>}
      </div>

      <Handle type="source" position={Position.Right} id="output"
        style={{ background: 'var(--brand)', border: '2px solid var(--bg-surface)', width: 14, height: 14 }} />
    </div>
  )
})
