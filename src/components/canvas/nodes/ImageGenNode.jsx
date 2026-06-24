import { memo, useState, useCallback, useSyncExternalStore } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import { IMAGE_MODELS } from '../utils/nodeDefaults'

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

export const ImageGenNode = memo(({ id, data }) => {
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
    if (!data.prompt) return
    setGenLoading(true)
    updateNodeData(id, { status: 'generating', errorMessage: '' })
    const controller = new AbortController()
    registerAbort(id, controller)
    try {
      const { generateImage } = await import('../../../lib/canvasApi')
      const result = await generateImage(data.prompt, {
        provider: data.modelProvider,
        aspectRatio: data.aspectRatio,
        count: data.imageCount,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      updateNodeData(id, {
        generatedImages: result.images || [],
        status: 'done',
      })
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return
      updateNodeData(id, { status: 'error', errorMessage: e.message })
    } finally {
      setGenLoading(false)
      unregisterAbort(id)
    }
  }

  const model = IMAGE_MODELS.find((m) => m.id === data.modelProvider)

  return (
    <div className="canvas-node" style={{ minWidth: 240 }}>
      <Handle type="target" position={Position.Left} id="prompt"
        style={{ ...handleStyle('var(--accent-music)'), top: '30%' }} />

      <div className="node-header" style={{ borderLeftColor: 'var(--accent-music)' }}>
        <span>🎨 {data.label}</span>
      </div>

      <div className="node-body" style={{ gap: 8 }}>
        {/* Model selector */}
        <select
          value={data.modelProvider}
          onChange={(e) => updateNodeData(id, { modelProvider: e.target.value })}
          className="node-select"
        >
          {IMAGE_MODELS.map((m) => {
            const hasKey = m.keyReuse ? userKeys.has(m.keyReuse) : false
            return (
              <option key={m.id} value={m.id}>
                {hasKey ? '✅ ' : '🔑 '}{m.name}
              </option>
            )
          })}
        </select>

        {/* Aspect ratio */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(model?.sizes || ['1024x1024']).map((s) => (
            <button
              key={s}
              className="node-chip"
              style={{
                background: data.aspectRatio === s ? 'var(--accent-music)' : 'var(--bg-root)',
                color: data.aspectRatio === s ? '#fff' : 'var(--text-dim)',
                border: '1px solid var(--border)',
                borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              }}
              onClick={() => updateNodeData(id, { aspectRatio: s })}
            >{s}</button>
          ))}
        </div>

        {/* Generate / Cancel buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="node-btn"
            onClick={handleGenerate}
            disabled={genLoading || !data.prompt}
            style={{
              flex: 1, background: 'var(--accent-music)', color: '#fff',
              opacity: (genLoading || !data.prompt) ? 0.5 : 1,
            }}
          >
            {genLoading ? '⏳ 生成中...' : '🎨 生成图片'}
          </button>
          {genLoading && (
            <button className="node-btn" onClick={handleCancel}
              style={{ background: '#ef4444', color: '#fff', padding: '5px 10px' }}>
              ✕
            </button>
          )}
        </div>

        {/* Generated images preview */}
        {data.generatedImages?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {data.generatedImages.map((img, i) => (
              <img key={i} src={img.url || img.base64} alt=""
                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
            ))}
          </div>
        )}

        {data.status === 'error' && (
          <div className="node-error">{data.errorMessage}</div>
        )}
      </div>

      <Handle type="source" position={Position.Right} id="output"
        style={{ ...handleStyle('var(--accent-music)'), top: '70%' }} />
    </div>
  )
})

const handleStyle = (color) => ({
  background: color, border: '2px solid var(--bg-surface)', width: 12, height: 12,
})
