import { memo, useState, useCallback, useMemo, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import { AGENT_MODES } from '../utils/nodeDefaults'

// Extract numbered shot prompts from agent response
function extractShots(text) {
  if (!text) return []
  const shots = []
  // Pattern 1: Structured shot blocks with <!--PROMPT:...--> markers
  const promptRe = /<!--PROMPT:(\w+)-->([\s\S]*?)<!--\/PROMPT:\1-->/g
  let match
  while ((match = promptRe.exec(text)) !== null) {
    const content = match[2].trim()
    // Check if it contains shot numbers like 镜1, 镜2, Shot 1, P1, 拍1
    const shotNums = content.match(/(?:镜|Shot\s*|P)(\d+)/gi)
    if (shotNums) {
      // This block likely contains multiple shots — split by shot number
      const parts = content.split(/(?=(?:镜\d+|Shot\s*\d+|P\d+|拍\d+))/)
      for (const part of parts) {
        const cleaned = part.trim()
        if (cleaned && cleaned.length > 10) {
          shots.push({ platform: match[1], prompt: cleaned })
        }
      }
    } else if (content.length > 10) {
      shots.push({ platform: match[1], prompt: content })
    }
  }
  // Pattern 2: Table-style shot numbering (| 1 | ... | 2 | ...)
  if (shots.length === 0) {
    const tableShots = text.match(/\|\s*(\d+)\s*\|[^|]+\|([^|]+)\|/g)
    if (tableShots) {
      tableShots.forEach(row => {
        const cols = row.split('|').map(c => c.trim()).filter(Boolean)
        if (cols.length >= 2) {
          shots.push({ platform: 'seedance', prompt: cols.slice(1).join(' | ') })
        }
      })
    }
  }
  // Pattern 3: Plain text with shot numbering
  if (shots.length === 0) {
    const lines = text.split('\n')
    for (const line of lines) {
      if (/(?:镜\d+|Shot\s*\d+|P\d+|拍\d+)/i.test(line) && line.length > 15) {
        shots.push({ platform: 'seedance', prompt: line.trim() })
      }
    }
  }
  return shots
}

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
  if (!text) return { prompts: [], negatives: {}, continuity: null, todo: null }
  const prompts = []
  const negatives = {}
  let continuity = null
  let todo = null

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

  return { prompts, negatives, continuity, todo }
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
      const { buildBibleContext } = await import('../../../lib/projectBible')
      // Inject project bible context for consistency
      const bibleCtx = buildBibleContext()
      const promptWithBible = bibleCtx ? `${bibleCtx}\n\n用户问题：${data.prompt}` : data.prompt
      const promptWithLang = data.prompt && !/中文|Chinese|用中文|请用中文/.test(data.prompt)
        ? `请用中文回答：\n${promptWithBible}` : promptWithBible
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


  // Pipeline runner: fire downstream agent execution
  const handleRunPipeline = useCallback(async () => {
    const s = useCanvasStore.getState()
    const downstreamAgents = s.edges
      .filter(e => e.source === id)
      .map(e => s.nodes.find(n => n.id === e.target))
      .filter(n => n && n.type === 'agent')
    if (downstreamAgents.length === 0) return

    // First ensure current agent has run
    if (!data.response || data.status !== 'done') {
      await handleRun()
    }

    // Fire custom event for each downstream agent to pick up
    downstreamAgents.forEach((agent, i) => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('pipeline-run', {
          detail: { nodeId: agent.id, delay: i * 500 }
        }))
      }, i * 300)
    })
  }, [id, data.response, data.status, handleRun])

  // Listen for pipeline execution trigger
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.nodeId === id && data.prompt && !genLoading && data.status !== 'generating') {
        setTimeout(() => handleRun(), e.detail.delay || 0)
      }
    }
    window.addEventListener('pipeline-run', handler)
    return () => window.removeEventListener('pipeline-run', handler)
  }, [id, data.prompt, genLoading, data.status, handleRun])

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
        {/* Agent picker — all 11 agents */}
        <select value={data.agentMode || 'director'}
          onChange={(e) => updateNodeData(id, { agentMode: e.target.value, response: '', status: 'idle' })}
          className="node-select">
          <option value="director">{AGENT_MODES.find(m=>m.id==='director')?.name||'🎬 导演'}</option>
          <option value="doctor">{AGENT_MODES.find(m=>m.id==='doctor')?.name||'📋 剧本医生'}</option>
          <option value="character">{AGENT_MODES.find(m=>m.id==='character')?.name||'👤 人物造型'}</option>
          <option value="scene">{AGENT_MODES.find(m=>m.id==='scene')?.name||'🏛️ 场景设计'}</option>
          <option value="designer">{AGENT_MODES.find(m=>m.id==='designer')?.name||'🎨 美术指导'}</option>
          <option value="cinematographer">{AGENT_MODES.find(m=>m.id==='cinematographer')?.name||'📷 摄影指导'}</option>
          <option value="seedance">{AGENT_MODES.find(m=>m.id==='seedance')?.name||'📖 剧幕文戏分析'}</option>
          <option value="sound">{AGENT_MODES.find(m=>m.id==='sound')?.name||'🔊 声音设计'}</option>
          <option value="colorist">{AGENT_MODES.find(m=>m.id==='colorist')?.name||'🎨 调色师'}</option>
          <option value="post">{AGENT_MODES.find(m=>m.id==='post')?.name||'🎛️ 后期总监'}</option>
          <option value="lens">{AGENT_MODES.find(m=>m.id==='lens')?.name||'🔍 视觉解析师'}</option>
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
                      meta={meta} negative={neg} />
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

                {/* 🎬 One-click multi-shot expansion */}
                <ShotExpandButton id={id} response={data.response} data={data} />
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

        {/* Pipeline runner: show when agent is done and has downstream agents */}
        {data.status === 'done' && hasResponse && <><PipelineButton id={id} onRun={handleRunPipeline} /><SuggestionBar agentMode={data.agentMode || 'director'} id={id} data={data} /></>}
      </div>

      <Handle type="source" position={Position.Right} id="output"
        style={{ background: 'var(--brand)', border: '2px solid var(--bg-surface)', width: 14, height: 14 }} />
    </div>
  )
})

// === Multi-Shot Expand Button ===
function ShotExpandButton({ id, response, data }) {
  const [expanded, setExpanded] = useState(false)

  const shots = useMemo(() => extractShots(response || ''), [response])
  if (shots.length === 0) return null

  const handleExpand = () => {
    const s = useCanvasStore.getState()
    const srcNode = s.nodes.find(n => n.id === id)
    if (!srcNode) return
    const baseX = srcNode.position.x
    const baseY = srcNode.position.y + 350

    // Check MAX_NODES (add 2 per shot: mediaGen + preview)
    if (s.nodes.length + shots.length * 2 > 100) {
      alert('节点数已达上限 (100)，请先清理画布')
      return
    }

    const now = Date.now()
    const rnd = () => Math.random().toString(36).slice(2, 7)
    const newNodes = [...s.nodes]
    const newEdges = [...s.edges]

    shots.forEach((shot, i) => {
      const genId = `n_exp_${now}_${i}_${rnd()}`
      const col = i % 3, row = Math.floor(i / 3)
      const pos = { x: baseX + col * 320, y: baseY + row * 350 }

      // Create MediaGen node
      newNodes.push({
        id: genId, type: 'mediaGen',
        position: pos,
        data: { label: shot.platform === 'seedance' ? '镜头' + (i + 1) : 'Shot ' + (i + 1), prompt: shot.prompt, mediaType: 'video' },
      })
      // Edge from agent to this gen node
      newEdges.push({
        id: `e_exp_${now}_${i}`,
        source: id, sourceHandle: 'output',
        target: genId, targetHandle: 'prompt',
        type: 'smoothstep', animated: true,
        style: { stroke: 'var(--accent)', strokeWidth: 3, strokeLinecap: 'round' },
      })

      // Create preview node
      const previewId = `n_pre_${now}_${i}_${rnd()}`
      newNodes.push({
        id: previewId, type: 'preview',
        position: { x: pos.x + 340, y: pos.y },
        data: { label: '预览 ' + (i + 1), outputType: 'video' },
      })
      newEdges.push({
        id: `e_pre_${now}_${i}`,
        source: genId, sourceHandle: 'output',
        target: previewId, targetHandle: 'input',
        type: 'smoothstep', animated: true,
        style: { stroke: 'var(--accent-sfx)', strokeWidth: 2, strokeLinecap: 'round' },
      })
    })

    useCanvasStore.setState({ nodes: newNodes, edges: newEdges })

    setExpanded(true)
    setTimeout(() => setExpanded(false), 2000)
  }

  return (
    <button
      onClick={handleExpand}
      disabled={expanded}
      style={{
        width: '100%', padding: '7px 0', fontSize: 11, fontWeight: 700,
        borderRadius: 6, border: '1px dashed var(--accent-music)',
        background: expanded ? 'var(--accent-music)' : 'transparent',
        color: expanded ? '#fff' : 'var(--accent-music)',
        cursor: expanded ? 'default' : 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {expanded ? `✅ 已创建 ${shots.length} 个镜头` : `🎬 一键展开 ${shots.length} 个镜头`}
    </button>
  )
}

// === Pipeline Runner Button ===
function PipelineButton({ id, onRun }) {
  const [running, setRunning] = useState(false)
  // Check for downstream agent nodes
  const downAgents = useCanvasStore(s => {
    return s.edges
      .filter(e => e.source === id)
      .map(e => s.nodes.find(n => n.id === e.target))
      .filter(n => n && n.type === 'agent')
  })

  if (downAgents.length === 0) return null

  const labels = downAgents.map(a => {
    const mode = AGENT_MODES.find(m => m.id === a.data?.agentMode)
    return mode?.name || 'Agent'
  }).join(' → ')

  const handleClick = async () => {
    setRunning(true)
    await onRun()
    setTimeout(() => setRunning(false), 1500)
  }

  return (
    <button
      onClick={handleClick}
      disabled={running}
      style={{
        width: '100%', padding: '6px 0', fontSize: 11, fontWeight: 700,
        borderRadius: 6, border: `1px dashed var(--brand)`,
        background: running ? 'var(--brand)' : 'transparent',
        color: running ? '#fff' : 'var(--brand)',
        cursor: running ? 'default' : 'pointer',
        transition: 'all 0.2s', marginTop: 4,
      }}
    >
      {running ? '⏳ 管线执行中...' : `🔗 运行管线: ${labels}`}
    </button>
  )
}

// Agent mode → next-step suggestions
const NEXT_STEPS = {
  director: [{ act: 'connect', to: 'mediaGen', label: '🎨 媒体生成 生成画面' }, { act: 'chain', to: 'agent', mode: 'cinematographer', label: '📷 摄影指导 细化镜头' }],
  doctor: [{ act: 'chain', to: 'agent', mode: 'director', label: '🎬 导演 基于修改重出分镜' }],
  character: [{ act: 'connect', to: 'mediaGen', label: '🎨 生成角色视觉' }, { act: 'chain', to: 'agent', mode: 'cinematographer', label: '📷 摄影指导 设计角色布光' }],
  scene: [{ act: 'connect', to: 'mediaGen', label: '🎨 生成场景图' }, { act: 'chain', to: 'agent', mode: 'cinematographer', label: '📷 摄影指导 设计场景拍摄' }],
  designer: [{ act: 'chain', to: 'agent', mode: 'cinematographer', label: '📷 摄影指导 转化视觉方案' }],
  cinematographer: [{ act: 'connect', to: 'mediaGen', label: '🎨 一键生成镜头' }, { act: 'expand', label: '🎬 展开为分镜镜头' }],
  seedance: [{ act: 'chain', to: 'agent', mode: 'cinematographer', label: '📷 摄影指导 设计镜头方案' }],
  lens: [{ act: 'chain', to: 'agent', mode: 'cinematographer', label: '📷 摄影指导 基于DNA设计' }, { act: 'connect', to: 'mediaGen', label: '🎨 用提取的提示词生成' }],
  sound: [{ act: 'chain', to: 'agent', mode: 'cinematographer', label: '📷 基于声音方案细化视觉' }],
  colorist: [{ act: 'chain', to: 'agent', mode: 'cinematographer', label: '📷 基于色彩方案调光' }],
  post: [{ act: 'connect', to: 'mediaGen', label: '🎨 生成最终画面' }],
}

function SuggestionBar({ agentMode, id, data }) {
  const suggestions = NEXT_STEPS[agentMode] || [{ act: 'connect', to: 'mediaGen', label: '🎨 生成画面' }]
  if (!data.response || data.status !== 'done') return null

  return (
    <div style={{
      fontSize: 10, padding: '4px 8px', borderRadius: 6, marginTop: 6,
      background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.1)',
    }}>
      <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 3 }}>💡 建议下一步：</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {suggestions.map((s, i) => (
          <span key={i} style={{
            padding: '2px 6px', borderRadius: 4, fontSize: 9,
            background: 'var(--bg-root)', color: 'var(--text-secondary)',
          }}>{s.label}</span>
        ))}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 9, marginTop: 2 }}>
        从右侧 Handle 拖线到目标节点即可创建连接
      </div>
    </div>
  )
}

// === Prompt Card Component ===
function PromptCard({ platform, content, meta, negative }) {
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
        padding: '4px 8px', background: `${meta.color}15`, borderBottom: `1px solid ${meta.color}20`,
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
