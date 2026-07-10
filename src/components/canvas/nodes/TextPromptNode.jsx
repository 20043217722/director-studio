import { memo, useMemo, useCallback, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import { cardHeader, cardBody, cardFooter, genButtonStyle, textareaStyle, sectionLabel } from '../utils/cardStyle'
import { NODE_COLORS, STATUS_COLORS } from '../utils/canvasTheme'

// ===== Intent Detection Patterns =====
const INTENTS = [
  { key: 'image', label: '🎨 生图', patterns: [/生成图|画.*图|文生图|生成.*图|图生图|配图|插图|海报|生成一张|画一张|create image/i, /sd|dall.e|midjourney|flux|seedream/i] },
  { key: 'video', label: '🎬 生视频', patterns: [/生成视频|做.*视频|文生视频|图生视频|生成一段|短视频|create video/i, /可灵|kling|seedance|runway|sora|wan/i] },
  { key: 'agent', label: '🧠 分析', patterns: [/分析|设计角色|设计场景|解析|诊断|拆解|帮我写|帮我设计|帮我分析|写.*剧本|设计.*人物/i] },
]

// ===== Parameter Extraction =====
function extractParams(text) {
  const params = {}

  // Aspect ratio
  const ratioMatch = text.match(/(\d+:\d+)\s*(比例|尺寸|画幅|比例)?/)
  if (ratioMatch) params.aspectRatio = ratioMatch[1]

  // Duration
  const durMatch = text.match(/(\d+)\s*(秒|s|sec)/i)
  if (durMatch) params.duration = parseInt(durMatch[1])

  // Resolution
  const resMatch = text.match(/(\d+)\s*(k|K)\b/)
  if (resMatch) params.resolution = resMatch[1] + 'K'

  // Negative prompts
  const negMatch = text.match(/(?:不要|排除|避免|禁止|负面|no\s|without\s|exclude\s)(.+?)(?:[，。,\.\n]|$)/gi)
  if (negMatch) params.negativePrompt = negMatch.map((m) => m.replace(/(?:不要|排除|避免|禁止|负面|no\s|without\s|exclude\s)/i, '').trim()).join(', ')

  // Style keywords
  const styleBank = ['赛博朋克', '古装', '现代', '复古', '科幻', '写实', '二次元', '水墨', '油画',
    '极简', '暗黑', '清新', '日系', '韩系', '欧美', '港风', '蒸汽波', '废土', '梦幻',
    'cyberpunk', 'realistic', 'anime', 'oil painting', 'minimalist', 'dark', 'vintage']
  const found = styleBank.filter((s) => text.toLowerCase().includes(s.toLowerCase()))
  if (found.length) params.styles = found.slice(0, 5)

  // Count
  const countMatch = text.match(/(\d+)\s*(张|幅|个|组)/)
  if (countMatch) params.imageCount = parseInt(countMatch[1])

  // Model preference
  const modelBank = { 'dall-e': 'openai', 'dalle': 'openai', 'sd': 'stability', 'stable diffusion': 'stability',
    'flux': 'flux', 'midjourney': 'midjourney', 'mj': 'midjourney', 'seedream': 'seedream', '通义': 'qwen',
    '可灵': 'kling', 'kling': 'kling', 'seedance': 'seedance', 'wan': 'wan', 'sora': 'sora' }
  for (const [kw, model] of Object.entries(modelBank)) {
    if (text.toLowerCase().includes(kw)) { params.modelProvider = model; break }
  }

  return params
}

// ===== Node Component =====
export const TextPromptNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const autoBuild = useCanvasStore((s) => s.autoBuild)
  const [showParams, setShowParams] = useState(false)

  const text = data.prompt || ''

  // Detect intent
  const detectedIntent = useMemo(() => {
    if (!text.trim()) return null
    for (const intent of INTENTS) {
      if (intent.patterns.some((p) => p.test(text))) return intent
    }
    return null
  }, [text])

  // Extract params
  const params = useMemo(() => text ? extractParams(text) : {}, [text])
  const paramCount = Object.keys(params).length

  // Build downstream with extracted params
  const handleAutoBuild = useCallback(() => {
    if (!detectedIntent) return
    const targetType = { image: 'imageGen', video: 'videoGen', agent: 'agent' }[detectedIntent.key] || 'preview'

    const genData = { prompt: text }
    if (params.aspectRatio) genData.aspectRatio = params.aspectRatio
    if (params.duration) genData.duration = Math.max(3, Math.min(15, params.duration))
    if (params.modelProvider) genData.modelProvider = params.modelProvider
    if (params.negativePrompt) genData.negativePrompt = params.negativePrompt
    if (params.imageCount) genData.imageCount = Math.min(4, params.imageCount)

    autoBuild(id, targetType, genData, detectedIntent.key !== 'agent')
  }, [detectedIntent, id, text, params, autoBuild])

  // Manually connect to downstream
  const handleConnectTo = useCallback((targetType) => {
    const genData = { prompt: text }
    if (params.aspectRatio) genData.aspectRatio = params.aspectRatio
    if (params.modelProvider) genData.modelProvider = params.modelProvider
    if (params.duration) genData.duration = Math.max(3, Math.min(15, params.duration))
    autoBuild(id, targetType, genData, false)
  }, [id, text, params, autoBuild])

    const col = NODE_COLORS.textPrompt || NODE_COLORS.agent
  const statusColor = data.status === 'generating' ? STATUS_COLORS.running : data.status === 'success' ? STATUS_COLORS.success : data.status === 'error' ? STATUS_COLORS.error : STATUS_COLORS.idle

  return (
    <div style={{
      background: col.bg, border: `1.5px solid ${col.border}`, borderRadius: 10,
      boxShadow: `0 0 12px ${col.glow}`, minWidth: 260, maxWidth: 400,
      overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={cardHeader('textPrompt', 'Text Prompt', data.status)}>
        <span style={statusDotStyle(data.status)} />
        <span>📝 {data.label || 'Text Prompt'}</span>
        <span style={{flex:1}} />
        <span style={{fontSize:10,opacity:0.5}}>text</span>
      </div>
      {/* Body */}
      <div style={cardBody()}>
        <div style={sectionLabel()}>Prompt</div>
        <textarea
          value={text}
          onChange={handleChange}
          placeholder='describe what you want to create...
e.g. "a cinematic shot of a lone figure standing in rain at night, neon reflections on wet pavement, 1990s crime drama style"'
          style={textareaStyle()}
        />
        {detectedIntent && (
          <div style={{fontSize:11, color:col.icon, padding:'4px 8px', background:col.glow, borderRadius:4}}>
            ➜ Detected: {detectedIntent.label}
          </div>
        )}
        {paramCount > 0 && !showParams && (
          <button onClick={() => setShowParams(true)}
            style={{fontSize:11, color:col.icon, background:'transparent', border:'none', cursor:'pointer', padding:0, textAlign:'left'}}>
            📋 {paramCount} parameter(s) extracted — click to view
          </button>
        )}
      </div>
      {/* Footer */}
      <div style={cardFooter()}>
        <span style={{fontSize:10, color:'#666'}}>{text.length} chars</span>
        <button onClick={handleAutoBuild} disabled={!detectedIntent}
          style={genButtonStyle('textPrompt', !detectedIntent)}>
          ⚡ Auto Build
        </button>
      </div> className="canvas-node" style={{ minWidth: 260, maxWidth: 340 }}>
      <div className="node-header" style={{ borderLeftColor: 'var(--accent-tts)' }}>
        <span>📝 {data.label}</span>
        {detectedIntent && (
          <span style={{ fontSize: 10, background: 'var(--accent-glow)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
            {detectedIntent.label}
          </span>
        )}
      </div>

      <div className="node-body" style={{ gap: 6 }}>
        <textarea
          value={text}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="输入创作指令... 赛博朋克海报16:9, 可灵5秒视频, 设计古装女侠"
          rows={4}
          className="node-textarea"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); useCanvasStore.getState().selectNode(id) }}
        />

        {/* Parameter pills */}
        {paramCount > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setShowParams(!showParams)}
              style={{ fontSize: 10, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              {showParams ? '收起' : `📋 ${paramCount} 参数`}
            </button>
            {showParams && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {params.aspectRatio && <ParamPill label={params.aspectRatio} color="var(--accent-tts)" />}
                {params.duration && <ParamPill label={`${params.duration}s`} color="var(--accent-sfx)" />}
                {params.resolution && <ParamPill label={params.resolution} color="var(--accent-tts)" />}
                {params.modelProvider && <ParamPill label={params.modelProvider} color="var(--accent-music)" />}
                {params.imageCount && <ParamPill label={`x${params.imageCount}`} color="var(--accent-tts)" />}
                {params.styles?.map((s) => <ParamPill key={s} label={s} color="var(--brand)" />)}
              </div>
            )}
          </div>
        )}

        {/* Negative prompt row */}
        {params.negativePrompt && (
          <div style={{ fontSize: 10, color: '#ef4444', padding: '4px 6px', background: 'rgba(239,68,68,0.06)', borderRadius: 4 }}>
            🚫 {params.negativePrompt.slice(0, 80)}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {detectedIntent && (
            <button className="node-btn" onClick={handleAutoBuild}
              style={{ flex: 1, background: 'var(--accent)', color: '#000', fontSize: 11 }}>
              ⚡ 一键搭建
            </button>
          )}
          {!detectedIntent && text.trim() && (
            <>
              <button className="node-chip" onClick={() => handleConnectTo('imageGen')}
                style={{ flex: 1, fontSize: 10, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--accent-music)', background: 'transparent', color: 'var(--accent-music)', cursor: 'pointer', fontWeight: 600 }}>
                +🎨 生图
              </button>
              <button className="node-chip" onClick={() => handleConnectTo('videoGen')}
                style={{ flex: 1, fontSize: 10, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--accent-sfx)', background: 'transparent', color: 'var(--accent-sfx)', cursor: 'pointer', fontWeight: 600 }}>
                +🎬 生视频
              </button>
            </>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Left} id="prompt"
        style={{ background: 'var(--accent-tts)', border: '2px solid var(--bg-surface)', width: 14, height: 14 }} />
      <Handle type="source" position={Position.Right} id="output"
        style={{ background: 'var(--accent-tts)', border: '2px solid var(--bg-surface)', width: 14, height: 14 }} />
    </div>
  )
})

function ParamPill({ label, color }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: color, color: '#fff', fontWeight: 600, opacity: 0.85 }}>
      {label}
    </span>
  )
}
