import { memo, useState, useCallback, useMemo, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import { AGENT_MODES } from '../utils/nodeDefaults'

function extractShots(text) {
  if (!text) return []
  const shots = []
  const promptRe = /<!--PROMPT:(\w+)-->([\s\S]*?)<!--\/PROMPT:\1-->/g
  let match
  while ((match = promptRe.exec(text)) !== null) {
    const content = match[2].trim()
    const parts = content.split(/(?=(?:镜\d+|Shot\s*\d+|P\d+|拍\d+))/)
    for (const part of parts) {
      const cleaned = part.trim()
      if (cleaned && cleaned.length > 10) shots.push({ platform: match[1], prompt: cleaned })
    }
  }
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

const PLATFORM_META = {
  seedance: { label: 'Seedance', color: '#8b5cf6' }, kling: { label: 'Kling', color: '#f97316' },
  runway: { label: 'Runway', color: '#06b6d4' }, sora: { label: 'Sora', color: '#10b981' },
  pika: { label: 'Pika', color: '#f59e0b' }, wan: { label: 'Wan', color: '#3b82f6' },
  hailuo: { label: 'Hailuo', color: '#6366f1' }, midjourney: { label: 'Midjourney', color: '#ec4899' },
  seedream: { label: 'Seedream', color: '#14b8a6' }, dalle: { label: 'DALL-E', color: '#ef4444' },
}

function parseResponseBlocks(text) {
  if (!text) return { prompts: [], negatives: {}, continuity: null, todo: null }
  const prompts = [], negatives = {}
  let continuity = null, todo = null
  const promptRe = /<!--PROMPT:(\w+)-->([\s\S]*?)<!--\/PROMPT:\1-->/g
  let match
  while ((match = promptRe.exec(text)) !== null) prompts.push({ platform: match[1], content: match[2].trim() })
  const negRe = /<!--NEGATIVE:(\w+)-->([\s\S]*?)<!--\/NEGATIVE:\1-->/g
  while ((match = negRe.exec(text)) !== null) negatives[match[1]] = match[2].trim()
  const lockRe = /<!--LOCK:continuity-->([\s\S]*?)<!--\/LOCK:continuity-->/
  const lockMatch = lockRe.exec(text)
  if (lockMatch) continuity = lockMatch[1].trim()
  const todoRe = /<!--TODO-->([\s\S]*?)<!--\/TODO-->/
  const todoMatch = todoRe.exec(text)
  if (todoMatch) todo = todoMatch[1].trim().split('\n').filter(Boolean)
  return { prompts, negatives, continuity, todo }
}

function stripBlocks(text) {
  if (!text) return ''
  return text.replace(/<!--PROMPT:\w+-->[\s\S]*?<!--\/PROMPT:\w+-->/g, '')
    .replace(/<!--NEGATIVE:\w+-->[\s\S]*?<!--\/NEGATIVE:\w+-->/g, '')
    .replace(/<!--LOCK:continuity-->[\s\S]*?<!--\/LOCK:continuity-->/g, '')
    .replace(/<!--TODO-->[\s\S]*?<!--\/TODO-->/g, '')
    .replace(/\n{3,}/g, '\n\n').trim()
}

export const AgentNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const registerAbort = useCanvasStore((s) => s.registerAbort)
  const unregisterAbort = useCanvasStore((s) => s.unregisterAbort)
  const [genLoading, setGenLoading] = useState(false)
  const [viewMode, setViewMode] = useState('prompts')

  const agent = AGENT_MODES.find((a) => a.id === (data.agentMode || 'director'))
  const agentName = agent?.name || 'AI Agent'
  const hasResponse = !!data.response

  const { prompts, negatives, continuity, todo } = useMemo(
    () => parseResponseBlocks(data.response || ''), [data.response])
  const analysisText = useMemo(() => stripBlocks(data.response || ''), [data.response])
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
      const bibleCtx = buildBibleContext()
      const promptWithBible = bibleCtx ? bibleCtx + '\n\nQuery: ' + data.prompt : data.prompt
      const apiOpts = { signal: ctrl.signal }
      if (data.sourceImage) {
        apiOpts.imageBase64 = data.sourceImage
        apiOpts.imageMime = 'image/jpeg'
      }
      let fullResponse = ''
      for await (const chunk of callAgentStream(promptWithBible, data.agentMode || 'director', apiOpts)) {
        if (ctrl.signal.aborted) return
        fullResponse += chunk
        updateNodeData(id, { response: fullResponse, status: 'generating' })
      }
      if (ctrl.signal.aborted) return
      updateNodeData(id, { status: 'done', prompt: fullResponse })
    } catch (e) {
      if (e.name === 'AbortError' || ctrl.signal.aborted) return
      updateNodeData(id, { status: 'error', errorMessage: e.message })
    } finally { setGenLoading(false); unregisterAbort(id) }
  }

  const shots = useMemo(() => extractShots(data.response || ''), [data.response])

  const handleExpand = useCallback(() => {
    const s = useCanvasStore.getState()
    const srcNode = s.nodes.find(n => n.id === id)
    if (!srcNode || !shots.length) return
    if (s.nodes.length + shots.length * 2 > 100) return
    const baseX = srcNode.position.x
    const baseY = srcNode.position.y + 350
    const now = Date.now()
    const rnd = () => Math.random().toString(36).slice(2, 7)
    const newNodes = [...s.nodes], newEdges = [...s.edges]
    shots.forEach((shot, i) => {
      const genId = 'n_exp_' + now + '_' + i + '_' + rnd()
      const col = i % 3, row = Math.floor(i / 3)
      const pos = { x: baseX + col * 320, y: baseY + row * 350 }
      newNodes.push({ id: genId, type: 'mediaGen', position: pos,
        data: { label: 'Shot ' + (i + 1), prompt: shot.prompt, mediaType: 'video' } })
      newEdges.push({ id: 'e_exp_' + now + '_' + i, source: id, sourceHandle: 'output',
        target: genId, targetHandle: 'prompt', type: 'smoothstep', animated: true,
        style: { stroke: '#6c63ff', strokeWidth: 3, strokeLinecap: 'round' } })
    })
    useCanvasStore.setState({ nodes: newNodes, edges: newEdges })
  }, [shots, id])

  return (
    <div className="canvas-node" style={{borderColor:'#f5c51840', minWidth:300, maxWidth:450}}>
      <Handle type="target" position={Position.Left} id="prompt"
        style={{ background: '#f5c518', border: '2px solid #1e1e32', width: 12, height: 12 }} />

      <div className="node-header">
        <span className="node-icon">AI</span>
        <span className="node-title">{agentName}</span>
        <span className={'node-status ' + (data.status === 'done' ? 'done' : data.status === 'generating' ? 'generating' : data.status === 'error' ? 'error' : 'idle')}>
          {data.status === 'generating' ? '...' : data.status === 'done' ? 'OK' : data.status === 'error' ? 'ERR' : ''}
        </span>
      </div>

      <div className="node-body">
        <select value={data.agentMode || 'director'}
          onChange={(e) => updateNodeData(id, { agentMode: e.target.value, response: '', status: 'idle' })}
          className="node-select">
          {AGENT_MODES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <textarea value={data.prompt || ''} onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder={agent ? agent.desc : 'Enter instruction...'} className="node-textarea" rows={2} style={{minHeight:48}} />

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="node-btn node-btn-primary" onClick={handleRun} disabled={genLoading || !data.prompt} style={{flex:1}}>
            {genLoading ? 'Thinking...' : 'Run'}
          </button>
          {genLoading && <button className="node-btn-danger" onClick={handleCancel}>X</button>}
        </div>

        {hasResponse && (
          <div className="agent-response">
            {hasPrompts && (
              <div className="media-tabs">
                <button className={'media-tab' + (viewMode === 'prompts' ? ' active' : '')} onClick={() => setViewMode('prompts')}>
                  Prompts ({prompts.length})
                </button>
                <button className={'media-tab' + (viewMode === 'analysis' ? ' active' : '')} onClick={() => setViewMode('analysis')}>
                  Analysis
                </button>
              </div>
            )}

            {viewMode === 'prompts' && hasPrompts && (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {continuity && (
                  <div style={{fontSize:10,padding:'6px 8px',borderRadius:6,background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.15)'}}>
                    <div style={{fontWeight:700,color:'#8b5cf6',marginBottom:2}}>Continuity Lock</div>
                    <div style={{color:'#c0c0d0',lineHeight:1.4}}>{continuity.slice(0,200)}</div>
                  </div>
                )}
                {prompts.map((p, i) => {
                  const meta = PLATFORM_META[p.platform] || { label: p.platform, color: '#888' }
                  return (
                    <div key={i} className="prompt-card">
                      <div className="prompt-card-header" style={{background:meta.color+'15',borderBottomColor:meta.color+'20'}}>
                        <span style={{fontSize:11,fontWeight:700,color:meta.color}}>{meta.label}</span>
                        <span style={{fontSize:9,color:'#666'}}>{p.content.length}ch</span>
                      </div>
                      <div className="prompt-card-body">{p.content}</div>
                    </div>
                  )
                })}
                {shots.length > 0 && (
                  <button onClick={handleExpand}
                    style={{width:'100%',padding:'7px 0',fontSize:11,fontWeight:700,borderRadius:6,
                      border:'1px dashed #8b5cf6',background:'transparent',color:'#8b5cf6',cursor:'pointer'}}>
                    Expand {shots.length} Shots
                  </button>
                )}
              </div>
            )}

            {viewMode === 'analysis' && (
              <div className="response-text">{analysisText.slice(0, 1500)}</div>
            )}

            {!hasPrompts && (
              <div className="response-text">{data.response.slice(0, 1500)}</div>
            )}
          </div>
        )}

        {data.status === 'error' && <div className="node-error">{data.errorMessage}</div>}
      </div>

      <Handle type="source" position={Position.Right} id="output"
        style={{ background: '#f5c518', border: '2px solid #1e1e32', width: 12, height: 12 }} />
    </div>
  )
})

function PromptCard({ platform, content, meta, negative }) {
  const [copied, setCopied] = useState(false)
  const [showNeg, setShowNeg] = useState(false)
  const handleCopy = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch {}
  }, [])
  return (
    <div className="prompt-card">
      <div className="prompt-card-header">
        <span style={{fontSize:11,fontWeight:700,color:meta.color}}>{meta.label}</span>
        <div style={{display:'flex',gap:4}}>
          <span style={{fontSize:9,color:'#666'}}>{content.length}ch</span>
          <button onClick={() => handleCopy(content)}
            style={{fontSize:11,background:copied?meta.color:'transparent',border:'1px solid '+meta.color+'40',borderRadius:4,padding:'1px 6px',cursor:'pointer',color:copied?'#fff':meta.color}}>
            {copied ? 'OK' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="prompt-card-body">{content}</div>
      {negative && (
        <div style={{borderTop:'1px solid #2a2a45'}}>
          <button onClick={() => setShowNeg(!showNeg)}
            style={{width:'100%',padding:'3px 8px',fontSize:10,background:'transparent',border:'none',cursor:'pointer',color:'#888',textAlign:'left'}}>
            {showNeg ? 'Hide' : 'Show'} Negative
          </button>
          {showNeg && <div style={{fontSize:10,lineHeight:1.4,padding:'4px 8px 6px',color:'#ef4444',whiteSpace:'pre-wrap'}}>{negative}</div>}
        </div>
      )}
    </div>
  )
}
