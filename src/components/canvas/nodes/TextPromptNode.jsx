import { memo, useMemo, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import { NODE_COLORS } from '../utils/canvasTheme'

const INTENTS = [
  { key: 'image', label: '图片', patterns: [/生成图|画.*图|文生图|配图|插图|海报|生成一张|^\/image/i, /dall.e|midjourney|flux|seedream/i] },
  { key: 'video', label: '视频', patterns: [/生成视频|文生视频|图生视频|短视频|^\/video/i, /可灵|kling|seedance|runway|sora|wan/i] },
  { key: 'agent', label: '智能体', patterns: [/分析|设计角色|设计场景|解析|诊断|拆解|帮我写|写.*剧本|^\/agent/i] },
]

function extractParams(text) {
  const params = {}
  const ratioMatch = text.match(/(\d+:\d+)\s*(比例|尺寸|画幅)?/)
  if (ratioMatch) params.aspectRatio = ratioMatch[1]
  const durMatch = text.match(/(\d+)\s*(秒|s|sec)/i)
  if (durMatch) params.duration = Math.max(3, Math.min(15, parseInt(durMatch[1])))
  const modelBank = { 'dall-e': 'openai', 'dalle': 'openai', 'flux': 'flux', 'midjourney': 'midjourney', 'seedream': 'seedream', '可灵': 'kling', 'kling': 'kling', 'seedance': 'seedance', 'wan': 'wan', 'sora': 'sora' }
  for (const [kw, model] of Object.entries(modelBank)) { if (text.toLowerCase().includes(kw)) { params.modelProvider = model; break } }
  return params
}

export const TextPromptNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const autoBuild = useCanvasStore((s) => s.autoBuild)
  const text = data.prompt || ''
  const negativeText = data.negativePrompt || ''
  const col = NODE_COLORS.textPrompt || NODE_COLORS.agent
  const isCollapsed = data.collapsed
  const isMuted = data.muted

  const detectedIntent = useMemo(() => {
    if (!text.trim()) return null
    for (const intent of INTENTS) { if (intent.patterns.some((p) => p.test(text))) return intent }
    return null
  }, [text])

  const params = useMemo(() => text ? extractParams(text) : {}, [text])
  const handleChange = useCallback((e) => { updateNodeData(id, { prompt: e.target.value }) }, [id, updateNodeData])
  const handleNegChange = useCallback((e) => { updateNodeData(id, { negativePrompt: e.target.value }) }, [id, updateNodeData])

  const handleAutoBuild = useCallback(() => {
    if (!detectedIntent) return
    const targetType = { image: 'mediaGen', video: 'mediaGen', agent: 'agent' }[detectedIntent.key] || 'mediaGen'
    const genData = { prompt: text, negativePrompt: negativeText, mediaType: detectedIntent.key === 'video' ? 'video' : 'image' }
    if (params.aspectRatio) genData.aspectRatio = params.aspectRatio
    if (params.duration) genData.duration = params.duration
    if (params.modelProvider) genData.modelProvider = params.modelProvider
    autoBuild(id, targetType, genData, detectedIntent.key !== 'agent')
  }, [detectedIntent, id, text, negativeText, params, autoBuild])

  const stateClass = data.status === 'error' ? ' error-state' : data.status === 'generating' ? ' generating-state' : data.status === 'done' ? ' done-state' : ''

  return (
    <div className={'canvas-node' + stateClass + (isCollapsed ? ' collapsed' : '') + (isMuted ? ' muted' : '')} style={{ borderColor: col.border + '66', boxShadow: '0 2px 16px rgba(0,0,0,0.3), 0 0 12px ' + col.glow }}>
      <div className="node-header-accent textPrompt" />
      <div className="node-header">
        <span className="node-icon">T</span>
        <span className="node-title">{data.label || '文本提示词'}</span>
        {isMuted && <span className="node-mute-badge">已静音</span>}
        <span className="node-status idle">{text.length ? '已填' : '待输入'}</span>
      </div>
      {!isCollapsed && <div className="node-body">
        <div className="node-section-label">正向提示词</div>
        <textarea value={text} onChange={handleChange}
          placeholder={'描述你想要的画面...\n例如：一个电影级镜头，雨夜中孤独的人影，霓虹灯反射在湿路面'}
          className="node-textarea" rows={3} />
        <div className="node-section-label">负向提示词</div>
        <textarea value={negativeText} onChange={handleNegChange}
          placeholder={'你不想要的元素...\n例如：模糊, 低质量, 变形的手指, 文字水印, 多余人'}
          className="node-textarea" rows={2} style={{minHeight:44, borderColor: '#ef444440'}} />
        {detectedIntent && (<div style={{fontSize:11, color:col.icon, padding:'4px 10px', background:'rgba(108,99,255,0.08)', borderRadius:6}}>检测到意图：{detectedIntent.label}</div>)}
        <div style={{display:'flex', gap:6, alignItems:'center'}}>
          <span style={{fontSize:10, color:'#666', flex:1}}>{text.length} 字</span>
          <button onClick={handleAutoBuild} disabled={!detectedIntent} className="node-btn node-btn-primary" style={{fontSize:11, padding:'5px 14px'}}>一键搭建</button>
        </div>
      </div>}
      <Handle type="target" position={Position.Left} id="prompt" style={{ background: col.border, border: '2px solid #1e1e32', width: 12, height: 12, top: '22%' }} />
      <div className="handle-label handle-label-left" style={{top:'22%',marginTop:-8}}>提示词</div>
      <Handle type="source" position={Position.Right} id="output" style={{ background: col.border, border: '2px solid #1e1e32', width: 12, height: 12, top: '35%' }} />
      <div className="handle-label handle-label-right" style={{top:'35%',marginTop:-8}}>正向输出</div>
      <Handle type="source" position={Position.Right} id="negative" style={{ background: '#ef4444', border: '2px solid #1e1e32', width: 12, height: 12, top: '70%' }} />
      <div className="handle-label handle-label-right" style={{top:'70%',marginTop:-8, color:'#ef4444'}}>负向输出</div>
    </div>
  )
})
