import { memo, useState, useCallback, useSyncExternalStore } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import Lightbox from '../Lightbox'
import { VIDEO_MODELS } from '../utils/nodeDefaults'

// --- Reactive API key detection ---
function useModelKeys() {
  const subscribe = useCallback((cb) => {
    const handler = () => cb()
    window.addEventListener('storage', handler)
    window.addEventListener('apikeys-changed', handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('apikeys-changed', handler)
    }
  }, [])
  const getSnapshot = useCallback(() => {
    try {
      const keys = JSON.parse(localStorage.getItem('api_keys') || '{}')
      return JSON.stringify(Object.keys(keys).sort())
    } catch { return '[]' }
  }, [])
  return new Set(JSON.parse(useSyncExternalStore(subscribe, getSnapshot)))
}

export const VideoGenNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const registerAbort = useCanvasStore((s) => s.registerAbort)
  const unregisterAbort = useCanvasStore((s) => s.unregisterAbort)
  const [genLoading, setGenLoading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const userKeys = useModelKeys()
  const model = VIDEO_MODELS.find((m) => m.id === data.modelProvider)
  const [minS, maxS] = model?.durationRange || [3, 15]

  const handleCancel = useCallback(() => {
    useCanvasStore.getState().abortGeneration(id)
    setGenLoading(false)
    updateNodeData(id, { status: 'idle', errorMessage: '' })
  }, [id, updateNodeData])

  const handleGenerate = async () => {
    if (!data.prompt && !data.sourceImage) return
    setGenLoading(true)
    updateNodeData(id, { status: 'generating', progress: 0 })
    const controller = new AbortController()
    registerAbort(id, controller)
    try {
      const { generateVideo, pollVideoGeneration } = await import('../../../lib/canvasApi')
      const { jobId } = await generateVideo(data.prompt || data.sourceImage, {
        provider: data.modelProvider,
        duration: data.duration,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return

      let lastProgress = -1
      for await (const update of pollVideoGeneration(jobId, {
        provider: data.modelProvider,
        signal: controller.signal,
      })) {
        if (controller.signal.aborted) return
        // Throttle: only update on ≥5% progress change or completion
        const p = update.progress || 0
        if (update.status !== 'done' && p - lastProgress < 5 && lastProgress >= 0) continue
        lastProgress = p
        updateNodeData(id, { progress: p, status: 'generating' })
        if (update.status === 'done') {
          updateNodeData(id, { generatedVideo: update, status: 'done', progress: 100 })
          break
        }
      }
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return
      updateNodeData(id, { status: 'error', errorMessage: e.message })
    } finally {
      setGenLoading(false)
      unregisterAbort(id)
    }
  }

  const handleDownload = useCallback(() => {
    const url = data.generatedVideo?.url
    if (!url) return
    const a = document.createElement('a')
    a.href = url; a.download = 'generated_video.mp4'; a.target = '_blank'; a.rel = 'noopener'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }, [data.generatedVideo])

  const videoUrl = data.generatedVideo?.url
  const hasVideo = !!videoUrl

  return (
    <div className="canvas-node video-gen-node" style={{ minWidth: 260, maxWidth: 380 }}>
      {/* --- Handles --- */}
      <Handle type="target" position={Position.Left} id="prompt"
        style={{ ...handleStyle('var(--accent-sfx)'), top: '22%' }} />
      <Handle type="target" position={Position.Left} id="image"
        style={{ ...handleStyle('var(--accent-clone)'), top: '42%' }} />

      {/* --- Header --- */}
      <div className="node-header" style={{ borderLeftColor: 'var(--accent-sfx)', justifyContent: 'space-between' }}>
        <span>🎬 {data.label}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color:
          data.status === 'done' ? 'var(--success)' :
          data.status === 'error' ? '#ef4444' :
          data.status === 'generating' ? 'var(--brand)' : 'var(--text-muted)' }}>
          {data.status === 'generating' ? '⏳' : data.status === 'done' ? '✅' : data.status === 'error' ? '❌' : '⏸'}
        </span>
      </div>

      {/* --- Body --- */}
      <div className="node-body" style={{ gap: 10 }}>
        {/* Model selector */}
        <select value={data.modelProvider}
          onChange={(e) => updateNodeData(id, { modelProvider: e.target.value })}
          className="node-select">
          {VIDEO_MODELS.map((m) => {
            const hasKey = m.keyReuse ? userKeys.has(m.keyReuse) : false
            return <option key={m.id} value={m.id}>{hasKey ? '✅' : '🔑'} {m.name}</option>
          })}
        </select>

        {/* Duration slider */}
        <div className="duration-control">
          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 24 }}>{data.duration || 5}s</span>
          <input type="range" min={minS} max={maxS} step={1}
            value={data.duration || 5}
            onChange={(e) => updateNodeData(id, { duration: parseInt(e.target.value) })}
            style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{minS}-{maxS}s</span>
        </div>

        {/* Generate / Cancel */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="node-btn node-btn-primary"
            onClick={handleGenerate}
            disabled={genLoading || (!data.prompt && !data.sourceImage)}
            style={{ flex: 1, background: 'var(--accent-sfx)', color: '#fff',
              opacity: (genLoading || (!data.prompt && !data.sourceImage)) ? 0.5 : 1 }}>
            {genLoading ? `⏳ ${data.progress || 0}%` : '🎬 生成视频'}
          </button>
          {genLoading && (
            <button className="node-btn node-btn-danger" onClick={handleCancel}
              style={{ background: '#ef4444', color: '#fff' }}>✕</button>
          )}
        </div>

        {/* Progress + stage */}
        {data.status === 'generating' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="progress-bar-lg" style={{ background: 'var(--border)', borderRadius: 5, height: 6 }}>
              <div style={{
                width: `${data.progress || 0}%`, height: '100%',
                background: 'linear-gradient(90deg, var(--accent-sfx), #f97316)',
                borderRadius: 5, transition: 'width 0.8s ease',
              }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
              {data.progress && data.progress >= 95 ? '即将完成...' : '生成中,请耐心等待...'}
            </span>
          </div>
        )}

        {/* Error + retry */}
        {data.status === 'error' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div className="node-error" style={{ flex: 1, margin: 0 }}>{data.errorMessage}</div>
            <button onClick={handleGenerate}
              style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg-root)', color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔄 重试
            </button>
          </div>
        )}

        {/* Video preview + actions */}
        {hasVideo && (
          <div className="video-preview-wrap">
            <video src={videoUrl} controls className="video-preview"
              style={{ width: '100%', borderRadius: 6, maxHeight: 200, background: '#000' }} />
            <div className="media-actions">
              <button className="img-action-btn" onClick={() => setLightboxOpen(true)} title="放大查看">🔍</button>
              <button className="img-action-btn" onClick={handleDownload} title="下载视频">⬇</button>
            </div>
          </div>
        )}
      </div>

      {/* --- Lightbox --- */}
      {lightboxOpen && hasVideo && (
        <Lightbox items={[{ url: videoUrl, type: 'video', name: 'Generated Video' }]} index={0}
          onClose={() => setLightboxOpen(false)} />
      )}

      <Handle type="source" position={Position.Right} id="output"
        style={{ ...handleStyle('var(--accent-sfx)'), top: '70%' }} />
    </div>
  )
})

const handleStyle = (c) => ({ background: c, border: '2px solid var(--bg-surface)', width: 12, height: 12 })
