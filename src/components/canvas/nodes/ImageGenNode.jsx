import { memo, useState, useCallback, useSyncExternalStore } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import Lightbox from '../Lightbox'
import { IMAGE_MODELS } from '../utils/nodeDefaults'

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

// --- Handle drag-to-node ---
function onImageDragStart(e, img) {
  e.dataTransfer.setData('application/canvas-image', JSON.stringify({
    url: img.url || img.base64,
    type: 'image',
    name: img.revised_prompt ? img.revised_prompt.slice(0, 40) : 'Generated Image',
  }))
  e.dataTransfer.effectAllowed = 'copy'
}

export const ImageGenNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const registerAbort = useCanvasStore((s) => s.registerAbort)
  const unregisterAbort = useCanvasStore((s) => s.unregisterAbort)
  const [genLoading, setGenLoading] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(-1)
  const userKeys = useModelKeys()
  const model = IMAGE_MODELS.find((m) => m.id === data.modelProvider)

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
      updateNodeData(id, { generatedImages: result.images || [], status: 'done' })
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return
      updateNodeData(id, { status: 'error', errorMessage: e.message })
    } finally {
      setGenLoading(false)
      unregisterAbort(id)
    }
  }

  const handleDownload = useCallback((img, e) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = img.url || img.base64
    a.download = img.revised_prompt ? img.revised_prompt.slice(0, 30) + '.png' : 'generated.png'
    a.target = '_blank'; a.rel = 'noopener'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }, [])

  const images = data.generatedImages || []
  const hasImages = images.length > 0

  return (
    <div className="canvas-node img-gen-node" style={{ minWidth: 260, maxWidth: 360 }}>
      {/* --- Handles --- */}
      <Handle type="target" position={Position.Left} id="prompt"
        style={{ ...handleStyle('var(--accent-music)'), top: '26%' }} />

      {/* --- Header --- */}
      <div className="node-header" style={{ borderLeftColor: 'var(--accent-music)', justifyContent: 'space-between' }}>
        <span>🎨 {data.label}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color:
          data.status === 'done' ? 'var(--success)' :
          data.status === 'error' ? '#ef4444' :
          data.status === 'generating' ? 'var(--brand)' : 'var(--text-muted)' }}>
          {data.status === 'generating' ? '⏳' : data.status === 'done' ? '✅' : data.status === 'error' ? '❌' : '⏸'}
        </span>
      </div>

      {/* --- Body --- */}
      <div className="node-body" style={{ gap: 10 }}>
        {/* Model + Aspect pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select value={data.modelProvider}
            onChange={(e) => updateNodeData(id, { modelProvider: e.target.value })}
            className="node-select" style={{ flex: 1, minWidth: 100 }}>
            {IMAGE_MODELS.map((m) => {
              const hasKey = m.keyReuse ? userKeys.has(m.keyReuse) : false
              return <option key={m.id} value={m.id}>{hasKey ? '✅' : '🔑'} {m.name}</option>
            })}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(model?.sizes || ['1024x1024']).map((s) => (
            <button key={s} className="node-pill"
              style={{
                background: data.aspectRatio === s ? 'var(--accent-music)' : 'var(--bg-root)',
                color: data.aspectRatio === s ? '#fff' : 'var(--text-dim)',
              }}
              onClick={() => updateNodeData(id, { aspectRatio: s })}>{s}</button>
          ))}
        </div>

        {/* Generate / Cancel */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="node-btn node-btn-primary"
            onClick={handleGenerate} disabled={genLoading || !data.prompt}
            style={{ flex: 1, background: 'var(--accent-music)', color: '#fff',
              opacity: (genLoading || !data.prompt) ? 0.5 : 1 }}>
            {genLoading ? '⏳ 生成中...' : '🎨 生成图片'}
          </button>
          {genLoading && (
            <button className="node-btn node-btn-danger" onClick={handleCancel}
              style={{ background: '#ef4444', color: '#fff' }}>✕</button>
          )}
        </div>

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

        {/* Generated images gallery */}
        {hasImages && (
          <div className="img-gallery">
            {images.map((img, i) => (
              <div key={i} className="img-gallery-item"
                draggable onDragStart={(e) => onImageDragStart(e, img)}>
                <img src={img.url || img.base64} alt={`Generated ${i + 1}`}
                  className="img-gallery-thumb"
                  onClick={() => setLightboxIdx(i)} />
                <div className="img-gallery-actions">
                  <button className="img-action-btn" title="放大查看"
                    onClick={() => setLightboxIdx(i)}>🔍</button>
                  <button className="img-action-btn" title="拖出为节点"
                    draggable onDragStart={(e) => onImageDragStart(e, img)}
                    style={{ cursor: 'grab' }}>⚡</button>
                  <button className="img-action-btn" title="下载"
                    onClick={(e) => handleDownload(img, e)}>⬇</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Lightbox --- */}
      {lightboxIdx >= 0 && hasImages && (
        <Lightbox
          items={images.map((img) => ({ url: img.url || img.base64, type: 'image', name: img.revised_prompt }))}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(-1)}
        />
      )}

      <Handle type="source" position={Position.Right} id="output"
        style={{ ...handleStyle('var(--accent-music)'), top: '70%' }} />
    </div>
  )
})

const handleStyle = (color) => ({
  background: color, border: '2px solid var(--bg-surface)', width: 12, height: 12,
})
