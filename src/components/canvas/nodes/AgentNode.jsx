import { memo, useState, useCallback, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import { AGENT_MODES } from '../utils/nodeDefaults'

// Platform display config (badge + color)
const PLATFORM_META = {
  seedance:  { label: '🎬 Seedance', color: '#8b5cf6' },
  kling:     { label: '🎥 可灵 Kling', color: '#f97316' },
  runway:    { label: '🎞️ Runway', color: '#06b6d4' },
  sora:      { label: '🌟 Sora', color: '#10b981' },
  pika:      { label: '✨ Pika', color: '#f59e0b' },
  wan:       { label: '🌊 万相 Wan', color: '#3b82f6' },
  hailuo:    { label: '🌊 海螺 Hailuo', color: '#6366f1' },
  midjourney:{ label: '🖼️ Midjourney', color: '#ec4899' },
  seedream:  { label: '🎨 Seedream', color: '#14b8a6' },
  dalle:     { label: '🖼️ DALL·E', color: '#ef4444' },
}

// Extract structured blocks from agent response
function parseResponseBlocks(text) {
  if (!text) return { prompts: [], negatives: {}, continuity: null, todo: null, tldr: null }
  const prompts = []
  const negatives = {}
  let continuity = null
  let todo = null
  let tldr = null

  // Prompt blocks
  const promptRe = /<!--PROMPT:(\w+)-->([\s\S]*?)<!--\/PROMPT:\1-->/g
  let match
  while ((match = promptRe.exec(text)) !== null) {
    prompts.push({ platform: match[1], content: match[2].trim() })
  }
  // Negative blocks
  const negRe = /<!--NEGATIVE:(\w+)-->([\s\S]*?)<!--\/NEGATIVE:\1-->/g
  while ((match = negRe.exec(text)) !== null) {
    negatives[match[1]] = match[2].trim()
  }
  // Continuity lock
  const lockRe = /<!--LOCK:continuity-->([\s\S]*?)<!--\/LOCK:continuity-->/
  const lockMatch = lockRe.exec(text)
  if (lockMatch) continuity = lockMatch[1].trim()
  // TODO checklist
  const todoRe = /<!--TODO-->([\s\S]*?)<!--\/TODO-->/
  const todoMatch = todoRe.exec(text)
  if (todoMatch) todo = todoMatch[1].trim().split('\n').filter(Boolean)

  return { prompts, negatives, continuity, todo, tldr }
}

// Separate full response from structured blocks for "analysis only" view
function stripBlocks(text) {
  if (!text) return ''
  return text
    .replace(/<!--PROMPT:\w+-->[\s\S]*?<!--\/PROMPT:\w+-->/g, '')
    .replace(/<!--NEGATIVE:\w+-->[\s\S]*?<!--\/NEGATIVE:\w+-->/g, '')
    .replace(/<!--LOCK:continuity-->[\s\S]*?<!--\/LOCK:continuity-->/g, '')
    .replace(/<!--TODO-->[\s\S]*?<!--\/TODO-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const AgentNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const registerAbort = useCanvasStore((s) => s.registerAbort)
  const unregisterAbort = useCanvasStore((s) => s.unregisterAbort)
  const [genLoading, setGenLoading] = useState(false)
  const [viewMode, setViewMode] = useState('prompts') // 'prompts' | 'analysis'

  const agent = AGENT_MODES.find((a) => a.id === (data.agentMode || 'director'))
  const agentName = agent?.name || 'AI 智能体'
  const hasResponse = !!data.response

  // Parse response into structured cards
  const { prompts, negatives, continuity, todo } = useMemo(
    () => parseResponseBlocks(data.response || ''),
    [data.response]
  )
  const analysisText = useMemo(
    () => stripBlocks(data.response || ''),
    [data.response]
  )
  const hasPrompts = prompts.length > 0
  const hasAnalysis = analysisText.length > 20

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
      const apiOpts = { signal: ctrl.signal }
      if (data.sourceImage) {
        if (data.sourceImages?.length > 1) {
          apiOpts.imageBase64s = data.sourceImages.map((img) => img.data)
          apiOpts.imageMimes = data.sourceImages.map((img) => img.type === 'video' ? 'video/mp4' : 'image/jpeg')
        } else {
          apiOpts.imageBase64 = data.sourceImage
          apiOpts.imageMime = 'image/jpeg'
        }
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
      // Auto-fill textarea with full response for downstream data flow
      updateNodeData(id, { status: 'done', prompt: fullResponse })
    } catch (e) {
      if (e.name === 'AbortError' || ctrl.signal.aborted) return
      updateNodeData(id, { status: 'error', errorMessage: e.message })
    } finally { setGenLoading(false); unregisterAbort(id) }
  }

  const copyText = useCallback(async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      // Brief flash - handled by per-card state
    } catch {}
  }, [])

  return (
    <div className="canvas-node agent-node" style={{ minWidth: 300, maxWidth: 450 }}>
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
        {/* Agent picker */}
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

        {/* === RESPONSE OUTPUT === */}
        {hasResponse && (
          <div className="agent-response">
            {/* View toggle tabs — only show if prompts exist */}
            {hasPrompts && (
              <div className="media-tabs" style={{ marginBottom: 8 }}>
                <button className={`media-tab ${viewMode === 'prompts' ? 'active' : ''}`}
                  onClick={() => setViewMode('prompts')}>
                  📋 提示词{hasPrompts ? ` (${prompts.length})` : ''}
                </button>
                <button className={`media-tab ${viewMode === 'analysis' ? 'active' : ''}`}
                  onClick={() => setViewMode('analysis')}>
                  📄 完整分析
                </button>
              </div>
            )}

            {/* === PROMPT CARD VIEW === */}
            {viewMode === 'prompts' && hasPrompts && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Continuity lock banner */}
                {continuity && (
                  <div style={{
                    fontSize: 10, padding: '6px 8px', borderRadius: 6,
                    background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                    maxHeight: 80, overflowY: 'auto',
                  }}>
                    <div style={{ fontWeight: 700, color: '#8b5cf6', marginBottom: 2 }}>🔒 连续性锁头（跨镜共享）</div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {continuity.slice(0, 300)}
                    </div>
                  </div>
                )}

                {/* Prompt cards */}
                {prompts.map((p, i) => {
                  const meta = PLATFORM_META[p.platform] || { label: `📝 ${p.platform}`, color: 'var(--text-muted)' }
                  const neg = negatives[p.platform]
                  return (
                    <PromptCard key={i} platform={p.platform} content={p.content}
                      meta={meta} negative={neg} onCopy={copyText} />
                  )
                })}

                {/* TODO checklist */}
                {todo && todo.length > 0 && (
                  <div style={{
                    fontSize: 10, padding: '6px 8px', borderRadius: 6,
                    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                  }}>
                    <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚠️ 待补充</div>
                    {todo.map((item, i) => (
                      <div key={i} style={{ color: 'var(--text-secondary)', padding: '1px 0' }}>{item}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === FULL ANALYSIS VIEW === */}
            {viewMode === 'analysis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Summary toolbar */}
                <div className="response-toolbar">
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {data.response.length} 字
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {hasPrompts && (
                      <span style={{ fontSize: 10, color: 'var(--accent-music)' }}>
                        {prompts.length} 条提示词
                      </span>
                    )}
                  </div>
                </div>
                <div className="response-text" style={{ userSelect: 'text', whiteSpace: 'pre-wrap',
                  fontSize: 12, lineHeight: 1.7, maxHeight: 200, overflowY: 'auto',
                  padding: 10, background: 'var(--bg-root)', borderRadius: 6 }}>
                  {data.response.slice(0, 2000)}
                  {data.response.length > 2000 && <span style={{ color: 'var(--text-muted)' }}>... (截断)</span>}
                </div>
              </div>
            )}

            {/* Fallback: no structured prompts → show raw text */}
            {!hasPrompts && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="response-text" style={{ userSelect: 'text', whiteSpace: 'pre-wrap',
                  fontSize: 12, lineHeight: 1.7, maxHeight: 200, overflowY: 'auto',
                  padding: 10, background: 'var(--bg-root)', borderRadius: 6 }}>
                  {data.response.slice(0, 2000)}
                  {data.response.length > 2000 && <span style={{ color: 'var(--text-muted)' }}>... (截断)</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {data.status === 'error' && <div className="node-error">{data.errorMessage}</div>}
      </div>

      <Handle type="source" position={Position.Right} id="output"
        style={{ background: 'var(--brand)', border: '2px solid var(--bg-surface)', width: 14, height: 14 }} />
    </div>
  )
})

// === Prompt Card Component ===
function PromptCard({ platform, content, meta, negative, onCopy }) {
  const [copied, setCopied] = useState(false)
  const [showNeg, setShowNeg] = useState(false)
  const maxPreview = 150

  const handleCopy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }, [])

  return (
    <div style={{
      borderRadius: 8, border: '1px solid var(--border)',
      background: 'var(--bg-root)', overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px', background: `${meta.color}15`, borderBottom: '1px solid ${meta.color}20',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>
          {meta.label}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{content.length}字</span>
          <button
            onClick={() => handleCopy(content)}
            title="复制提示词"
            style={{
              fontSize: 11, background: copied ? meta.color : 'transparent',
              border: `1px solid ${meta.color}40`, borderRadius: 4,
              padding: '1px 6px', cursor: 'pointer',
              color: copied ? '#fff' : meta.color,
              transition: 'all 0.15s',
            }}
          >
            {copied ? '✅' : '📋'}
          </button>
        </div>
      </div>

      {/* Card body — prompt preview */}
      <div style={{
        fontSize: 11, lineHeight: 1.5, padding: '6px 8px',
        color: 'var(--text)', userSelect: 'text',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: content.length > maxPreview ? 120 : 'none',
        overflowY: content.length > maxPreview ? 'auto' : 'visible',
      }}>
        {content}
      </div>

      {/* Negative prompt toggle */}
      {negative && (
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setShowNeg(!showNeg)}
            style={{
              width: '100%', padding: '3px 8px', fontSize: 10,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', textAlign: 'left',
            }}
          >
            {showNeg ? '🔼 隐藏' : '🔽 展开'}负向提示词
          </button>
          {showNeg && (
            <div style={{
              fontSize: 10, lineHeight: 1.4, padding: '4px 8px 6px',
              color: '#ef4444', userSelect: 'text',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {negative}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
