import { memo, useState, useCallback, useSyncExternalStore } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import { VIDEO_MODELS } from '../utils/nodeDefaults'

// Reactive hook: re-renders when localStorage api_keys change
// Returns a Set — snapshot must be a stable comparable value (string) to avoid infinite loop
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
  // IMPORTANT: getSnapshot must return a value that is === stable between identical reads.
  // Returning a new Set each time causes React error #185 (infinite re-render).
  const getSnapshot = useCallback(() => {
    try {
      const keys = JSON.parse(localStorage.getItem('api_keys') || '{}')
      return JSON.stringify(Object.keys(keys).sort())
    } catch { return '[]' }
  }, [])
  const keysJson = useSyncExternalStore(subscribe, getSnapshot)
  return new Set(JSON.parse(keysJson))
}

export const VideoGenNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const registerAbort = useCanvasStore((s) => s.registerAbort)
  const unregisterAbort = useCanvasStore((s) => s.unregisterAbort)
  const [genLoading, setGenLoading] = useState(false)
  const userKeys = useModelKeys()

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
      for await (const update of pollVideoGeneration(jobId, {
        provider: data.modelProvider,
        signal: controller.signal,
      })) {
        if (controller.signal.aborted) return
        updateNodeData(id, { progress: update.progress || 0, status: 'generating' })
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

  return (
    <div className="canvas-node" style={{ minWidth: 240 }}>
      <Handle type="target" position={Position.Left} id="prompt"
        style={{ ...handleStyle('var(--accent-sfx)'), top: '25%' }} />
      <Handle type="target" position={Position.Left} id="image"
        style={{ ...handleStyle('var(--accent-clone)'), top: '45%' }} />

      <div className="node-header" style={{ borderLeftColor: 'var(--accent-sfx)' }}>
        <span>🎬 {data.label}</span>
      </div>

      <div className="node-body" style={{ gap: 8 }}>
        <select value={data.modelProvider} onChange={(e) => updateNodeData(id, { modelProvider: e.target.value })}
          className="node-select">
          {VIDEO_MODELS.map((m) => {
            const hasKey = m.keyReuse ? userKeys.has(m.keyReuse) : false
            return (<option key={m.id} value={m.id}>{hasKey ? '✅ ' : '🔑 '}{m.name}</option>)
          })}
        </select>

        {/* Duration slider 3-15s */}
        {(() => {
          const model = VIDEO_MODELS.find((m) => m.id === data.modelProvider)
          const [minS, maxS] = model?.durationRange || [3, 15]
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 20 }}>{data.duration || 5}s</span>
              <input type="range" min={minS} max={maxS} step={1}
                value={data.duration || 5}
                onChange={(e) => updateNodeData(id, { duration: parseInt(e.target.value) })}
                style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{minS}-{maxS}s</span>
            </div>
          )
        })()}

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="node-btn" onClick={handleGenerate}
            disabled={genLoading || (!data.prompt && !data.sourceImage)}
            style={{ flex: 1, background: 'var(--accent-sfx)', color: '#fff', opacity: (genLoading || (!data.prompt && !data.sourceImage)) ? 0.5 : 1 }}>
            {genLoading ? `⏳ ${data.progress}%` : '🎬 生成视频'}
          </button>
          {genLoading && (
            <button className="node-btn" onClick={handleCancel}
              style={{ background: '#ef4444', color: '#fff', padding: '5px 10px' }}>
              ✕
            </button>
          )}
        </div>

        {data.status === 'generating' && (
          <div className="progress-bar" style={{ background: 'var(--border)', borderRadius: 4, height: 4 }}>
            <div style={{ width: `${data.progress}%`, height: '100%', background: 'var(--accent-sfx)', borderRadius: 4, transition: 'width 0.5s' }} />
          </div>
        )}

        {data.generatedVideo?.url && (
          <video src={data.generatedVideo.url} controls style={{ width: '100%', borderRadius: 4, maxHeight: 120 }} />
        )}
        {data.status === 'error' && <div className="node-error">{data.errorMessage}</div>}
      </div>

      <Handle type="source" position={Position.Right} id="output"
        style={{ ...handleStyle('var(--accent-sfx)'), top: '70%' }} />
    </div>
  )
})

const handleStyle = (c) => ({ background: c, border: '2px solid var(--bg-surface)', width: 12, height: 12 })
