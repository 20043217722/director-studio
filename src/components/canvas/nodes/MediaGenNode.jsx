import { memo, useState, useCallback, useSyncExternalStore } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import Lightbox from '../Lightbox'
import { IMAGE_MODELS, VIDEO_MODELS, HANDLE_IDS } from '../utils/nodeDefaults'

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
    try { return JSON.stringify(Object.keys(JSON.parse(localStorage.getItem('api_keys') || '{}')).sort()) }
    catch { return '[]' }
  }, [])
  return new Set(JSON.parse(useSyncExternalStore(subscribe, getSnapshot)))
}

// --- Drag image to canvas as ReferenceNode ---
function onImageDragStart(e, img) {
  e.dataTransfer.setData('application/canvas-image', JSON.stringify({
    url: img.url || img.base64, type: 'image',
    name: img.revised_prompt ? img.revised_prompt.slice(0, 40) : 'Generated',
  }))
  e.dataTransfer.effectAllowed = 'copy'
}

// Auto-create a Preview node downstream if none exists
function ensurePreviewDownstream(sourceId) {
  const s = useCanvasStore.getState()
  const hasPreview = s.edges.some((e) => {
    if (e.source !== sourceId) return false
    const tgt = s.nodes.find((n) => n.id === e.target)
    return tgt && tgt.type === 'preview'
  })
  if (hasPreview) return
  // Auto-build preview
  const srcNode = s.nodes.find((n) => n.id === sourceId)
  if (!srcNode) return
  const pos = { x: srcNode.position.x + 360, y: srcNode.position.y }
  s.autoBuild(sourceId, 'preview', {}, false)
}

export const MediaGenNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const registerAbort = useCanvasStore((s) => s.registerAbort)
  const unregisterAbort = useCanvasStore((s) => s.unregisterAbort)
  const [genLoading, setGenLoading] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(-1)
  const [videoLightbox, setVideoLightbox] = useState(false)
  const userKeys = useModelKeys()

  const mediaType = data.mediaType || 'image'
  const isImage = mediaType === 'image'
  const isVideo = mediaType === 'video'

  // --- Model lists per mode ---
  const imageModel = IMAGE_MODELS.find((m) => m.id === data.modelProvider)
  const videoModel = VIDEO_MODELS.find((m) => m.id === data.modelProvider)
  const currentModels = isImage ? IMAGE_MODELS : VIDEO_MODELS
  const [durMin, durMax] = isVideo ? (videoModel?.durationRange || [3, 15]) : [3, 15]

  // --- Cancel ---
  const handleCancel = useCallback(() => {
    useCanvasStore.getState().abortGeneration(id)
    setGenLoading(false)
    updateNodeData(id, { status: 'idle', errorMessage: '' })
  }, [id, updateNodeData])

  // --- Generate ---
  const handleGenerate = async () => {
    // Video mode can use sourceImage (img2vid) without prompt; image mode requires prompt
    if (!data.prompt && (isImage || !data.sourceImage)) return
    setGenLoading(true)
    updateNodeData(id, { status: 'generating', progress: 0, errorMessage: '' })
    const ctrl = new AbortController()
    registerAbort(id, ctrl)

    try {
      if (isImage) {
        const { generateImage } = await import('../../../lib/canvasApi')
        const r = await generateImage(data.prompt, {
          provider: data.modelProvider || 'gpt-image-1',
          aspectRatio: data.aspectRatio || '1:1',
          count: data.imageCount || 1,
          signal: ctrl.signal,
        })
        if (ctrl.signal.aborted) return
        updateNodeData(id, { generatedImages: r.images || [], status: 'done' })
        // Auto-create Preview node if no downstream preview exists
        ensurePreviewDownstream(id)
      } else {
        const { generateVideo, pollVideoGeneration } = await import('../../../lib/canvasApi')
        const { jobId } = await generateVideo(data.prompt || data.sourceImage, {
          provider: data.modelProvider || 'sora',
          duration: data.duration || 5,
          signal: ctrl.signal,
        })
        if (ctrl.signal.aborted) return
        let lastP = -1
        for await (const u of pollVideoGeneration(jobId, {
          provider: data.modelProvider || 'sora',
          signal: ctrl.signal,
        })) {
          if (ctrl.signal.aborted) return
          const p = u.progress || 0
          if (u.status !== 'done' && p - lastP < 5 && lastP >= 0) continue
          lastP = p
          // Single atomic update: merge progress + video data into one call
          if (u.status === 'done') {
            updateNodeData(id, { generatedVideo: u, status: 'done', progress: 100 })
            ensurePreviewDownstream(id)
            break
          }
          updateNodeData(id, { progress: p, status: 'generating', stage: u.stage })
        }
      }
    } catch (e) {
      if (e.name === 'AbortError' || ctrl.signal.aborted) return
      updateNodeData(id, { status: 'error', errorMessage: e.message })
    } finally {
      setGenLoading(false)
      unregisterAbort(id)
    }
  }

  // --- Download ---
  const handleDownload = useCallback((img, e) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = img.url || img.base64
    a.download = 'generated.png'; a.target = '_blank'; a.rel = 'noopener'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }, [])

  const handleDownloadVideo = useCallback(() => {
    if (!data.generatedVideo?.url) return
    const a = document.createElement('a')
    a.href = data.generatedVideo.url; a.download = 'generated_video.mp4'
    a.target = '_blank'; a.rel = 'noopener'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }, [data.generatedVideo])

  const imgItems = (data.generatedImages || []).map((img, i) => ({
    url: img.url || img.base64, type: 'image', name: img.revised_prompt || `Generated ${i + 1}`,
  }))

  return (
    <div className="canvas-node media-gen-node" style={{ minWidth: 280, maxWidth: 400 }}>
      {/* --- Handles --- */}
      <Handle type="target" position={Position.Left} id={HANDLE_IDS.target.prompt}
        style={{ ...handleStyle('var(--accent-music)'), top: '18%' }} />
      <Handle type="target" position={Position.Left} id={HANDLE_IDS.target.image}
        style={{ ...handleStyle('var(--accent-clone)'), top: '36%' }} />

      {/* === TOP: Media Preview Area === */}

      {/* Media type toggle */}
      <div className="media-tabs">
        <button className={`media-tab ${isImage ? 'active' : ''}`}
          onClick={() => updateNodeData(id, { mediaType: 'image' })}>
          🎨 生图
        </button>
        <button className={`media-tab ${isVideo ? 'active' : ''}`}
          onClick={() => updateNodeData(id, { mediaType: 'video' })}>
          🎬 生视频
        </button>
        <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 'auto', color:
          data.status === 'done' ? 'var(--success)' :
          data.status === 'error' ? '#ef4444' :
          data.status === 'generating' ? 'var(--brand)' : 'var(--text-muted)' }}>
          {data.status === 'generating' ? '⏳' : data.status === 'done' ? '✅' :
           data.status === 'error' ? '❌' : ''}
        </span>
      </div>

      {/* Image mode: gallery */}
      {isImage && data.generatedImages?.length > 0 && (
        <div className="img-gallery" style={{ marginBottom: 8 }}>
          {data.generatedImages.map((img, i) => (
            <div key={i} className="img-gallery-item"
              draggable onDragStart={(e) => onImageDragStart(e, img)}>
              <img src={img.url || img.base64} alt=""
                className="img-gallery-thumb" style={{ maxHeight: 220 }}
                onClick={() => setLightboxIdx(i)} />
              <div className="img-gallery-actions">
                <button className="img-action-btn" onClick={() => setLightboxIdx(i)}>🔍</button>
                <button className="img-action-btn" draggable onDragStart={(e) => onImageDragStart(e, img)}
                  style={{ cursor: 'grab' }}>⚡</button>
                <button className="img-action-btn" onClick={(e) => handleDownload(img, e)}>⬇</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image mode: empty placeholder */}
      {isImage && !data.generatedImages?.length && data.status !== 'generating' && (
        <div className="media-placeholder" style={{ minHeight: 80 }}>
          <span style={{ fontSize: 28 }}>🎨</span>
          <span>输入提示词，点击生成</span>
        </div>
      )}

      {/* Video mode: player or progress */}
      {isVideo && (
        <>
          {data.generatedVideo?.url ? (
            <div className="video-preview-wrap" style={{ marginBottom: 8 }}>
              <video src={data.generatedVideo.url} controls
                style={{ width: '100%', maxHeight: 200, borderRadius: 6, background: '#000' }} />
              <div className="media-actions">
                <button className="img-action-btn" onClick={() => setVideoLightbox(true)}>🔍</button>
                <button className="img-action-btn" onClick={handleDownloadVideo}>⬇</button>
              </div>
            </div>
          ) : data.status !== 'generating' ? (
            <div className="media-placeholder" style={{ minHeight: 80 }}>
              <span style={{ fontSize: 28 }}>🎬</span>
              <span>输入提示词，点击生成</span>
            </div>
          ) : null}

          {data.status === 'generating' && (
            <div style={{ padding: '4px 0 8px' }}>
              <div style={{ background: 'var(--border)', borderRadius: 5, height: 8, marginBottom: 4 }}>
                <div style={{ width: `${data.progress || 0}%`, height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-sfx), #f97316)',
                  borderRadius: 5, transition: 'width 0.8s' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                {data.progress >= 95 ? '即将完成...' : `生成中 ${data.progress || 0}%`}
              </div>
            </div>
          )}
        </>
      )}

      {/* === MIDDLE: Model + Params === */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <select value={data.modelProvider || (isImage ? 'gpt-image-1' : 'sora')}
          onChange={(e) => updateNodeData(id, { modelProvider: e.target.value })}
          className="node-select" style={{ flex: 1, minWidth: 100 }}>
          {currentModels.map((m) => {
            const hasKey = m.keyReuse ? userKeys.has(m.keyReuse) : false
            return <option key={m.id} value={m.id}>{hasKey ? '✅' : '🔑'} {m.name}</option>
          })}
        </select>
      </div>

      {/* Aspect ratio (image) or Duration (video) */}
      {isImage && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {(imageModel?.sizes || ['1024x1024']).map((s) => (
            <button key={s} className="node-pill"
              style={{ background: data.aspectRatio === s ? 'var(--accent-music)' : 'var(--bg-root)',
                color: data.aspectRatio === s ? '#fff' : 'var(--text-dim)' }}
              onClick={() => updateNodeData(id, { aspectRatio: s })}>{s}</button>
          ))}
        </div>
      )}

      {isVideo && (
        <div className="duration-control" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 24 }}>{data.duration || 5}s</span>
          <input type="range" min={durMin} max={durMax} step={1}
            value={data.duration || 5}
            onChange={(e) => updateNodeData(id, { duration: parseInt(e.target.value) })}
            style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{durMin}-{durMax}s</span>
        </div>
      )}

      {/* === BOTTOM: Prompt + Generate === */}
      <textarea
        value={data.prompt || ''}
        onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
        placeholder={isImage ? '描述你想生成的画面...' : '描述视频场景... 支持图生视频：从上游拖入图片'}
        rows={3} className="node-textarea"
        style={{ marginBottom: 6 }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Generate / Cancel */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="node-btn node-btn-primary"
          onClick={handleGenerate} disabled={genLoading || (!data.prompt && (isImage || !data.sourceImage))}
          style={{ flex: 1, background: isImage ? 'var(--accent-music)' : 'var(--accent-sfx)', color: '#fff',
            opacity: (genLoading || !data.prompt) ? 0.5 : 1 }}>
          {genLoading
            ? (isImage ? '⏳ 生成中...' : `⏳ ${data.progress || 0}%`)
            : (isImage ? '🎨 生成图片' : '🎬 生成视频')}
        </button>
        {genLoading && (
          <button className="node-btn node-btn-danger" onClick={handleCancel}
            style={{ background: '#ef4444', color: '#fff' }}>✕</button>
        )}
      </div>

      {/* Error + retry */}
      {data.status === 'error' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
          <div className="node-error" style={{ flex: 1, margin: 0 }}>{data.errorMessage}</div>
          <button onClick={handleGenerate}
            style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border)',
              background: 'var(--bg-root)', color: 'var(--text)', cursor: 'pointer' }}>🔄 重试</button>
        </div>
      )}

      {/* --- Lightbox --- */}
      {lightboxIdx >= 0 && isImage && imgItems.length > 0 && (
        <Lightbox items={imgItems} index={lightboxIdx} onClose={() => setLightboxIdx(-1)} />
      )}
      {videoLightbox && data.generatedVideo?.url && (
        <Lightbox items={[{ url: data.generatedVideo.url, type: 'video' }]} index={0}
          onClose={() => setVideoLightbox(false)} />
      )}

      <Handle type="source" position={Position.Right} id={HANDLE_IDS.source}
        style={{ ...handleStyle(isImage ? 'var(--accent-music)' : 'var(--accent-sfx)'), top: '70%' }} />
    </div>
  )
})

const handleStyle = (c) => ({ background: c, border: '2px solid var(--bg-surface)', width: 12, height: 12 })
