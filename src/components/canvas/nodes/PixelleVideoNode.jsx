import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'

const PIXELLE_BASE = 'http://localhost:8000'

const TTS_OPTIONS = [
  { id: 'edge', name: 'Edge-TTS (免费)', desc: '微软 AI 语音' },
  { id: 'index', name: 'Index-TTS (音色克隆)', desc: '高保真克隆' },
  { id: 'chattts', name: 'ChatTTS (对话)', desc: '自然对话风格' },
]

const BGM_OPTIONS = [
  { id: 'uplift', name: '激励向上' },
  { id: 'cinematic', name: '电影大片' },
  { id: 'acoustic', name: '清新原声' },
  { id: 'electronic', name: '电子科技' },
  { id: 'none', name: '无 BGM' },
]

const TEMPLATES = [
  { id: '1080x1920/image_default.html', name: '竖屏 9:16', icon: '📱' },
  { id: '1920x1080/image_default.html', name: '横屏 16:9', icon: '🖥️' },
]

const STAGE_LABELS = {
  init: '初始化环境...',
  script: '生成文案脚本...',
  title: '生成标题...',
  planning: '分镜视觉规划...',
  storyboard: '初始化分镜...',
  media: '素材生产中...',
  compositing: '后期合成中...',
  finalize: '保存输出...',
}

export const PixelleVideoNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('')

  const handleGenerate = async () => {
    if (!data.prompt) return
    setLoading(true)
    updateNodeData(id, { status: 'generating', progress: 0 })
    try {
      const { generatePixelleVideo, pollPixelleVideo } = await import('../../../lib/canvasApi')

      setStage('init')
      const { taskId } = await generatePixelleVideo(data.prompt, {
        nScenes: data.nScenes || 5,
        template: data.template || '1080x1920/image_default.html',
        tts: data.tts || 'edge',
        bgm: data.bgm || 'uplift',
      })

      for await (const update of pollPixelleVideo(taskId)) {
        setStage(update.stage || '')
        if (update.progress != null) updateNodeData(id, { progress: update.progress, status: 'generating' })
        if (update.status === 'done') {
          updateNodeData(id, { generatedVideo: { url: update.url }, status: 'done', progress: 100 })
          break
        }
        if (update.status === 'failed') throw new Error(update.error || 'Pixelle-Video 生成失败')
      }
    } catch (e) {
      updateNodeData(id, { status: 'error', errorMessage: e.message })
    } finally {
      setLoading(false)
      setStage('')
    }
  }

  return (
    <div className="canvas-node" style={{ minWidth: 260 }}>
      <Handle type="target" position={Position.Left} id="prompt"
        style={{ ...handleStyle('#8b5cf6'), top: '22%' }} />

      <div className="node-header" style={{ borderLeftColor: '#8b5cf6' }}>
        <span>🎞️ {data.label}</span>
      </div>

      <div className="node-body" style={{ gap: 6 }}>
        {/* Template selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TEMPLATES.map((t) => (
            <button key={t.id}
              onClick={() => updateNodeData(id, { template: t.id })}
              style={{
                flex: 1, padding: '4px 6px', fontSize: 11, borderRadius: 4,
                border: data.template === t.id ? '2px solid #8b5cf6' : '1px solid var(--border)',
                background: data.template === t.id ? 'rgba(139,92,246,0.1)' : 'transparent',
                color: 'var(--text)', cursor: 'pointer',
              }}
            >{t.icon} {t.name}</button>
          ))}
        </div>

        {/* Scene count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>分镜数</span>
          <input type="range" min={3} max={10} step={1}
            value={data.nScenes || 5}
            onChange={(e) => updateNodeData(id, { nScenes: parseInt(e.target.value) })}
            style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 16, textAlign: 'right' }}>{data.nScenes || 5}</span>
        </div>

        {/* TTS engine */}
        <select value={data.tts || 'edge'} onChange={(e) => updateNodeData(id, { tts: e.target.value })}
          className="node-select">
          {TTS_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* BGM style */}
        <select value={data.bgm || 'uplift'} onChange={(e) => updateNodeData(id, { bgm: e.target.value })}
          className="node-select">
          {BGM_OPTIONS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        {/* Generate button */}
        <button className="node-btn" onClick={handleGenerate}
          disabled={loading || !data.prompt}
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff',
            opacity: (loading || !data.prompt) ? 0.5 : 1,
          }}>
          {loading ? `⏳ ${STAGE_LABELS[stage] || stage}` : '🎞️ 一键生成短视频'}
        </button>

        {/* Progress bar */}
        {data.status === 'generating' && (
          <div style={{ background: 'var(--border)', borderRadius: 4, height: 4 }}>
            <div style={{
              width: `${data.progress}%`, height: '100%',
              background: 'linear-gradient(to right, #8b5cf6, #6d28d9)',
              borderRadius: 4, transition: 'width 0.5s',
            }} />
          </div>
        )}

        {/* Stage indicator */}
        {loading && stage && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            {STAGE_LABELS[stage] || stage}
          </div>
        )}

        {/* Generated video preview */}
        {data.generatedVideo?.url && (
          <video src={data.generatedVideo.url} controls
            style={{ width: '100%', borderRadius: 4, maxHeight: 140 }} />
        )}

        {data.status === 'error' && <div className="node-error">{data.errorMessage}</div>}
      </div>

      <Handle type="source" position={Position.Right} id="output"
        style={{ ...handleStyle('#8b5cf6'), top: '70%' }} />
    </div>
  )
})

const handleStyle = (c) => ({ background: c, border: '2px solid var(--bg-surface)', width: 12, height: 12 })
