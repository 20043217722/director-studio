import { useState, useCallback } from 'react'
import { useCanvasStore } from './utils/canvasStore'

// Intent patterns (borrowed from TextPromptNode)
const INTENTS = [
  { key: 'image', label: '🎨', patterns: [/生成图|画.*图|文生图|生成.*图|图生图|配图|插图|海报|生成一张|画一张|create image|^\/image/i, /sd|dall.e|midjourney|flux|seedream/i] },
  { key: 'video', label: '🎬', patterns: [/生成视频|做.*视频|文生视频|图生视频|生成一段|短视频|create video|^\/video/i, /可灵|kling|seedance|runway|sora|wan/i] },
  { key: 'agent', label: '🧠', patterns: [/分析|设计角色|设计场景|解析|诊断|拆解|帮我写|帮我设计|帮我分析|写.*剧本|设计.*人物|^\/agent/i] },
]

function detectIntent(text) {
  if (!text.trim()) return null
  for (const intent of INTENTS) {
    if (intent.patterns.some((p) => p.test(text))) return intent
  }
  return { key: 'image', label: '🎨' } // default to image
}

function extractParams(text) {
  const params = {}
  const ratioMatch = text.match(/(\d+:\d+)\s*(比例|尺寸|画幅)?/)
  if (ratioMatch) params.aspectRatio = ratioMatch[1]
  const durMatch = text.match(/(\d+)\s*(秒|s|sec)/i)
  if (durMatch) params.duration = Math.max(3, Math.min(15, parseInt(durMatch[1])))
  const modelBank = { 'dall-e': 'gpt-image-1', 'dalle': 'gpt-image-1', 'flux': 'flux',
    'midjourney': 'midjourney', 'seedream': 'seedream', 'agnes': 'agnes-image',
    '可灵': 'kling', 'sora': 'sora', 'seedance': 'seedance', 'wan': 'wan' }
  for (const [kw, model] of Object.entries(modelBank)) {
    if (text.toLowerCase().includes(kw)) { params.modelProvider = model; break }
  }
  return params
}

export function CanvasInputBar() {
  const [text, setText] = useState('')
  const [detected, setDetected] = useState(null)
  const nodeCount = useCanvasStore((s) => s.nodes.length)

  const handleChange = useCallback((e) => {
    const v = e.target.value
    setText(v)
    setDetected(detectIntent(v))
  }, [])

  const handleSubmit = useCallback(() => {
    if (!text.trim()) return
    const intent = detectIntent(text)
    if (!intent) return
    const params = extractParams(text)
    const targetMap = { image: 'imageGen', video: 'videoGen', agent: 'agent' }
    const targetType = targetMap[intent.key] || 'imageGen'

    const s = useCanvasStore.getState()
    // Calculate position using fresh state (not hook value which may be stale)
    const freshNodes = s.nodes
    const lastNode = freshNodes.length > 0
      ? freshNodes.reduce((a, b) => a.position.y > b.position.y ? a : b)
      : null
    const startX = lastNode ? lastNode.position.x : 300
    const startY = lastNode ? lastNode.position.y + 280 : 200

    s.addNode('textPrompt', { x: startX, y: startY })
    const textNode = s.nodes[s.nodes.length - 1]
    if (textNode) {
      s.updateNodeData(textNode.id, { prompt: text }, { syncDownstream: false })
      const genData = { prompt: text }
      if (params.aspectRatio) genData.aspectRatio = params.aspectRatio
      if (params.duration) genData.duration = params.duration
      if (params.modelProvider) genData.modelProvider = params.modelProvider
      s.autoBuild(textNode.id, targetType, genData, true)
    }

    setText('')
    setDetected(null)
  }, [text])

  // Hide when canvas is empty (CanvasWelcome shows instead)
  if (nodeCount === 0) return null

  return (
    <div className="canvas-input-bar">
      <div className="canvas-input-inner">
        {detected && <span className="canvas-input-intent">{detected.label}</span>}
        <input
          value={text}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          placeholder="输入创作需求，Enter 一键搭建流程..."
          className="canvas-input-field"
        />
        <button className="canvas-input-btn" onClick={handleSubmit}
          disabled={!text.trim()} title="Enter 发送">
          ▶
        </button>
      </div>
      <div className="canvas-input-hints">
        <span>/image 生图</span><span>/video 生视频</span><span>/agent 分析</span>
        <span style={{ opacity: 0.5 }}>Enter 发送</span>
      </div>
    </div>
  )
}
