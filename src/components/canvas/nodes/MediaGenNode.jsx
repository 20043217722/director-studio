import { memo, useState, useCallback, useEffect, useSyncExternalStore } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import Lightbox from '../Lightbox'
import { IMAGE_MODELS, VIDEO_MODELS, HANDLE_IDS } from '../utils/nodeDefaults'

function useModelKeys() {
  const subscribe = useCallback((cb) => { const handler = () => cb(); window.addEventListener('storage', handler); window.addEventListener('apikeys-changed', handler); return () => { window.removeEventListener('storage', handler); window.removeEventListener('apikeys-changed', handler) } }, [])
  const getSnapshot = useCallback(() => { try { return JSON.stringify(Object.keys(JSON.parse(localStorage.getItem('api_keys') || '{}')).sort()) } catch { return '[]' } }, [])
  return new Set(JSON.parse(useSyncExternalStore(subscribe, getSnapshot)))
}

function onImageDragStart(e, img) {
  e.dataTransfer.setData('application/canvas-image', JSON.stringify({ url: img.url || img.base64, type: 'image', name: img.revised_prompt ? img.revised_prompt.slice(0, 40) : '生成图片' }))
  e.dataTransfer.effectAllowed = 'copy'
}

export const MediaGenNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const registerAbort = useCanvasStore((s) => s.registerAbort)
  const unregisterAbort = useCanvasStore((s) => s.unregisterAbort)
  const [genLoading, setGenLoading] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(-1)
  const [videoLightbox, setVideoLightbox] = useState(false)
  const [showParams, setShowParams] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const userKeys = useModelKeys()

  const mediaType = data.mediaType || 'image'
  const isImage = mediaType === 'image'; const isVideo = mediaType === 'video'
  const isCollapsed = data.collapsed; const isMuted = data.muted

  const currentModels = isImage ? IMAGE_MODELS : VIDEO_MODELS
  const imageModel = IMAGE_MODELS.find((m) => m.id === data.modelProvider)
  const videoModel = VIDEO_MODELS.find((m) => m.id === data.modelProvider)
  const [durMin, durMax] = isVideo ? (videoModel?.durationRange || [3, 15]) : [3, 15]
  const imageVersions = data.imageVersions || []
  const [currentImgVer, setCurrentImgVer] = useState(imageVersions.length > 0 ? imageVersions.length - 1 : 0)
  const [compareLeft, setCompareLeft] = useState(0)
  const [compareRight, setCompareRight] = useState(1)
  const allImageVersions = [...imageVersions]
  if (data.generatedImages?.length > 0 && !imageVersions.includes(data.generatedImages)) allImageVersions.push(data.generatedImages)
  const batchResults = data.batchResults || []

  const handleCancel = useCallback(() => { useCanvasStore.getState().abortGeneration(id); setGenLoading(false); setBatchLoading(false); updateNodeData(id, { status: 'idle', errorMessage: '' }) }, [id, updateNodeData])

  // Single generate
  const handleGenerate = async () => {
    if (!data.prompt && (isImage || !data.sourceImage)) return
    setGenLoading(true)
    const versPatch = {}
    if (isImage && data.generatedImages?.length > 0) versPatch.imageVersions = [...(data.imageVersions || []), data.generatedImages]
    if (isVideo && data.generatedVideo?.url) versPatch.videoVersions = [...(data.videoVersions || []), data.generatedVideo]
    updateNodeData(id, { ...versPatch, status: 'generating', progress: 0, errorMessage: '' })
    const ctrl = new AbortController(); registerAbort(id, ctrl)
    try {
      if (isImage) {
        const progressTimer = setInterval(() => { const s = useCanvasStore.getState(); const n = s.nodes.find(n => n.id === id); if (n && n.data.status === 'generating') { const p = Math.min((n.data.progress || 0) + 15, 90); updateNodeData(id, { progress: p }) } }, 800)
        const { generateImage } = await import('../../../lib/canvasApi')
        const r = await generateImage(data.prompt, { provider: data.modelProvider || 'gpt-image-1', aspectRatio: data.aspectRatio || '1:1', count: data.imageCount || 1, signal: ctrl.signal })
        clearInterval(progressTimer)
        if (ctrl.signal.aborted) return
        updateNodeData(id, { generatedImages: r.images || [], status: 'done', progress: 100 })
      } else {
        const { generateVideo, pollVideoGeneration } = await import('../../../lib/canvasApi')
        const { jobId } = await generateVideo(data.prompt || data.sourceImage, { provider: data.modelProvider || 'sora', duration: data.duration || 5, signal: ctrl.signal })
        if (ctrl.signal.aborted) return
        let lastP = -1
        for await (const u of pollVideoGeneration(jobId, { provider: data.modelProvider || 'sora', signal: ctrl.signal })) { if (ctrl.signal.aborted) return; const p = u.progress || 0; if (u.status !== 'done' && p - lastP < 5 && lastP >= 0) continue; lastP = p; if (u.status === 'done') { updateNodeData(id, { generatedVideo: u, status: 'done', progress: 100 }); break }; updateNodeData(id, { progress: p, status: 'generating', stage: u.stage }) }
      }
    } catch (e) { if (e.name === 'AbortError' || ctrl.signal.aborted) return; updateNodeData(id, { status: 'error', errorMessage: e.message }) }
    finally { setGenLoading(false); unregisterAbort(id) }
  }

  // BATCH GENERATE: 4 variants in parallel
  const handleBatchGenerate = async () => {
    if (!data.prompt || !isImage) return
    setBatchLoading(true)
    updateNodeData(id, { batchResults: [], status: 'generating' })
    const ctrl = new AbortController(); registerAbort(id, ctrl)
    const results = []
    try {
      const { generateImage } = await import('../../../lib/canvasApi')
      for (let i = 0; i < 4; i++) {
        if (ctrl.signal.aborted) return
        results.push({ status: 'generating', index: i })
        updateNodeData(id, { batchResults: [...results], progress: Math.round((i / 4) * 100) })
        try {
          const r = await generateImage(data.prompt, { provider: data.modelProvider || 'gpt-image-1', aspectRatio: data.aspectRatio || '1:1', count: 1, signal: ctrl.signal })
          if (ctrl.signal.aborted) return
          results[i] = { status: 'done', index: i, image: r.images?.[0] }
        } catch (e) {
          if (ctrl.signal.aborted) return
          results[i] = { status: 'error', index: i, error: e.message }
        }
        updateNodeData(id, { batchResults: [...results], progress: Math.round(((i + 1) / 4) * 100) })
      }
      updateNodeData(id, { status: 'done', progress: 100 })
      // Auto-save batch results to versions
      const goodImages = results.filter(r => r.status === 'done' && r.image).map(r => r.image)
      if (goodImages.length) {
        const vers = [...(data.imageVersions || [])]
        if (data.generatedImages?.length) vers.push(data.generatedImages)
        vers.push(goodImages)
        updateNodeData(id, { generatedImages: goodImages, imageVersions: vers })
      }
    } catch (e) { if (e.name === 'AbortError' || ctrl.signal.aborted) return; updateNodeData(id, { status: 'error', errorMessage: e.message }) }
    finally { setBatchLoading(false); unregisterAbort(id) }
  }

  useEffect(() => { const handler = (e) => { const s = useCanvasStore.getState(); const isUpstream = s.edges.some(edge => edge.source === id && edge.target === e.detail?.previewId); if (isUpstream && !genLoading && data.prompt) { handleGenerate() } }; window.addEventListener('preview-retry', handler); return () => window.removeEventListener('preview-retry', handler) }, [id, genLoading, data.prompt])

  const handleDownload = useCallback((img, e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = img.url || img.base64; a.download = 'generated.png'; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); document.body.removeChild(a) }, [])
  const handleDownloadVideo = useCallback(() => { if (!data.generatedVideo?.url) return; const a = document.createElement('a'); a.href = data.generatedVideo.url; a.download = 'generated_video.mp4'; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); document.body.removeChild(a) }, [data.generatedVideo])
  const handlePaste = useCallback((e) => { const items = e.clipboardData?.items; if (!items) return; for (const item of items) { if (item.type.startsWith('image/')) { const file = item.getAsFile(); if (!file) continue; const reader = new FileReader(); reader.onload = () => updateNodeData(id, { sourceImage: reader.result }); reader.readAsDataURL(file); break } } }, [id, updateNodeData])

  const imgItems = (data.generatedImages || []).map((img, i) => ({ url: img.url || img.base64, type: 'image', name: img.revised_prompt || '生成 ' + (i + 1) }))

  const stateClass = data.status === 'error' ? ' error-state' : data.status === 'generating' ? ' generating-state' : data.status === 'done' ? ' done-state' : ''
  const collapseClass = isCollapsed ? ' collapsed' : ''
  const muteClass = isMuted ? ' muted' : ''

  return (
    <div className={'canvas-node' + stateClass + collapseClass + muteClass} style={{ borderColor: (isImage ? '#e94560' : '#0f3460') + '40' }}>
      <div className={'node-header-accent ' + (isImage ? 'mediaGen' : 'videoGen')} />
      <Handle type="target" position={Position.Left} id={HANDLE_IDS.target.prompt} style={{ background: isImage ? '#e94560' : '#0f3460', border: '2px solid #1e1e32', width: 12, height: 12, top: '15%' }} />
      <div className="handle-label handle-label-left" style={{top:'15%',marginTop:-8}}>提示词</div>
      <Handle type="target" position={Position.Left} id={HANDLE_IDS.target.image} style={{ background: '#4ade80', border: '2px solid #1e1e32', width: 12, height: 12, top: '35%' }} />
      <div className="handle-label handle-label-left" style={{top:'35%',marginTop:-8}}>参考图</div>

      <div className="node-header">
        <span className="node-icon">{isImage ? '图' : '视'}</span>
        <span className="node-title">{data.label || (isImage ? '图片生成' : '视频生成')}</span>
        {isMuted && <span className="node-mute-badge">已静音</span>}
        <span className={'node-status ' + (data.status === 'done' ? 'done' : data.status === 'generating' ? 'generating' : data.status === 'error' ? 'error' : 'idle')}>
          {data.status === 'generating' ? (data.progress || 0) + '%' : data.status === 'done' ? '完成' : data.status === 'error' ? '错误' : '待机'}
        </span>
      </div>

      {!isCollapsed && <div className="node-body">
        <div className="media-tabs">
          <button className={'media-tab' + (isImage ? ' active' : '')} onClick={() => updateNodeData(id, { mediaType: 'image' })}>生成图片</button>
          <button className={'media-tab' + (isVideo ? ' active' : '')} onClick={() => updateNodeData(id, { mediaType: 'video' })}>生成视频</button>
        </div>

        {/* --- BATCH MODE: 2x2 variation grid --- */}
        {(batchLoading || batchResults.length > 0) && isImage && (
          <div className="batch-grid">
            {[0,1,2,3].map(idx => {
              const result = batchResults[idx]
              const isGen = batchLoading && (!result || result.status === 'generating')
              const img = result?.status === 'done' ? result.image : null
              const isErr = result?.status === 'error'
              return (
                <div key={idx} className={'batch-item' + (isGen ? ' generating' : '')}
                  onClick={() => { if (img) setLightboxIdx(idx) }}
                  title={isErr ? result.error : '变体 ' + (idx + 1)}>
                  {img ? <img src={img.url || img.base64} alt="" /> :
                   isGen ? <span>⏳</span> :
                   isErr ? <span style={{color:'#ef4444',fontSize:10}}>❌</span> :
                   <span style={{color:'#555',fontSize:10}}>-</span>}
                  {result && <span className="batch-label">#{idx + 1}</span>}
                </div>
              )
            })}
          </div>
        )}

        {/* --- MAIN GALLERY --- */}
        {isImage && data.status === 'generating' && !batchResults.length && (<div className="node-progress-bar"><div className="node-progress-fill image" style={{ width: (data.progress || 0) + '%' }} /></div>)}
        {isImage && data.generatedImages?.length > 0 && (
          <div className="img-gallery">
            {data.generatedImages.map((img, i) => (<div key={i} className="img-gallery-item" draggable onDragStart={(e) => onImageDragStart(e, img)}><img src={img.url || img.base64} alt="" className="img-gallery-thumb" onClick={() => setLightboxIdx(i)} /><div className="img-gallery-actions"><button className="img-action-btn" onClick={() => setLightboxIdx(i)}>放大</button><button className="img-action-btn" onClick={(e) => handleDownload(img, e)}>下载</button></div></div>))}
          </div>
        )}
        {isImage && !data.generatedImages?.length && data.status !== 'generating' && !batchResults.length && (<div className="node-preview-placeholder"><span className="ph-icon">[ ]</span><span>输入提示词，点击生成</span></div>)}

        {/* --- VERSION THUMBNAILS --- */}
        {isImage && allImageVersions.length > 1 && (
          <div>
            <div className="node-section-label" style={{marginBottom:4}}>版本历史 ({allImageVersions.length})</div>
            <div className="version-thumbs">
              {allImageVersions.map((versionImgs, vi) => {
                const thumb = versionImgs?.[0]
                const isActive = vi === currentImgVer
                return (
                  <div key={vi} className={'version-thumb' + (isActive ? ' active' : '')}
                    onClick={() => { setCurrentImgVer(vi); updateNodeData(id, { generatedImages: versionImgs }) }}
                    title={'版本 ' + (vi + 1)}>
                    {thumb?.url || thumb?.base64 ? <img src={thumb.url || thumb.base64} alt="" /> : <span className="v-number">v{vi + 1}</span>}
                  </div>
                )
              })}
              {allImageVersions.length >= 2 && (
                <button className="version-thumb" style={{borderColor:'#8b5cf6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,color:'#8b5cf6',background:'transparent'}}
                  onClick={() => { setCompareLeft(currentImgVer); setCompareRight(Math.min(allImageVersions.length - 1, currentImgVer + 1)); setCompareMode(true) }}>
                  对比
                </button>
              )}
            </div>
          </div>
        )}

        {isVideo && data.generatedVideo?.url && (<div className="video-preview-wrap"><video src={data.generatedVideo.url} controls className="video-preview" /><div className="media-actions"><button className="img-action-btn" onClick={() => setVideoLightbox(true)}>放大</button><button className="img-action-btn" onClick={handleDownloadVideo}>下载</button></div></div>)}
        {isVideo && !data.generatedVideo?.url && data.status !== 'generating' && (<div className="node-preview-placeholder"><span className="ph-icon">[V]</span><span>输入提示词，点击生成视频</span></div>)}
        {isVideo && data.status === 'generating' && (<div className="node-progress-bar"><div className="node-progress-fill video" style={{ width: (data.progress || 0) + '%' }} /></div>)}

        <button onClick={() => setShowParams(!showParams)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 10, cursor: 'pointer', textAlign: 'left', padding: 0 }}>{showParams ? '收起参数' : '展开参数...'}</button>

        {showParams && (<>
          <select value={data.modelProvider || (isImage ? 'gpt-image-1' : 'sora')} onChange={(e) => updateNodeData(id, { modelProvider: e.target.value })} className="node-select">{currentModels.map((m) => { const hasKey = m.keyReuse ? userKeys.has(m.keyReuse) : false; return <option key={m.id} value={m.id}>{hasKey ? '*' : '-'} {m.name}</option> })}</select>
          {isImage && (<div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(imageModel?.sizes || ['1024x1024']).map((s) => (<button key={s} className={'node-pill' + (data.aspectRatio === s ? ' active' : '')} onClick={() => updateNodeData(id, { aspectRatio: s })}>{s}</button>))}</div>)}
          {isVideo && (<div className="duration-control"><span style={{fontSize:11,color:'#888'}}>{data.duration || 5}秒</span><input type="range" min={durMin} max={durMax} step={1} value={data.duration || 5} onChange={(e) => updateNodeData(id, { duration: parseInt(e.target.value) })} style={{ flex: 1 }} /><span style={{fontSize:10,color:'#666'}}>{durMin}-{durMax}秒</span></div>)}
        </>)}

        <textarea value={data.prompt || ''} onChange={(e) => updateNodeData(id, { prompt: e.target.value })} placeholder={isImage ? '描述你想生成的画面...' : '描述视频场景或拖入参考图...'} className="node-textarea" rows={2} style={{minHeight:48}} onPasteCapture={handlePaste} />

        <div style={{ display: 'flex', gap: 6 }}>
          <button className={'node-btn-generate ' + (isImage ? 'image' : 'video')} onClick={handleGenerate} disabled={genLoading || batchLoading || (!data.prompt && (isImage || !data.sourceImage))}>
            {genLoading ? (isImage ? '生成中 ' + (data.progress || 0) + '%' : (data.progress || 0) + '%') : (isImage ? '生成图片' : '生成视频')}
          </button>
          {genLoading && <button className="node-btn-danger" onClick={handleCancel}>取消</button>}
        </div>

        {/* Batch generate button — image mode only */}
        {isImage && (
          <button onClick={handleBatchGenerate} disabled={genLoading || batchLoading || !data.prompt}
            style={{width:'100%',padding:'7px 0',fontSize:11,fontWeight:700,borderRadius:6,
              border:'1px dashed #e94560',background:batchLoading?'rgba(233,69,96,0.1)':'transparent',
              color:batchLoading?'#e94560':'#888',cursor:batchLoading?'default':'pointer',
              transition:'all 0.15s'}}>
            {batchLoading ? '批量生成中 ' + (data.progress || 0) + '%' : '生成 4 个变体'}
          </button>
        )}

        {data.status === 'error' && <div className="node-error">{data.errorMessage}</div>}
      </div>}

      {/* --- COMPARE MODE OVERLAY --- */}
      {compareMode && allImageVersions.length >= 2 && (
        <div className="compare-overlay" onClick={() => setCompareMode(false)}>
          <button className="compare-close" onClick={() => setCompareMode(false)}>×</button>
          <div className="compare-grid" onClick={(e) => e.stopPropagation()}>
            <div className="compare-slot">
              <div className="slot-label">版本 {compareLeft + 1}</div>
              {allImageVersions[compareLeft]?.[0]?.url || allImageVersions[compareLeft]?.[0]?.base64 ? (
                <img src={allImageVersions[compareLeft][0].url || allImageVersions[compareLeft][0].base64} alt="" />
              ) : <div style={{color:'#666',padding:40}}>无数据</div>}
            </div>
            <div style={{fontSize:24,color:'#888'}}>vs</div>
            <div className="compare-slot">
              <div className="slot-label">版本 {compareRight + 1}</div>
              {allImageVersions[compareRight]?.[0]?.url || allImageVersions[compareRight]?.[0]?.base64 ? (
                <img src={allImageVersions[compareRight][0].url || allImageVersions[compareRight][0].base64} alt="" />
              ) : <div style={{color:'#666',padding:40}}>无数据</div>}
            </div>
          </div>
        </div>
      )}

      {lightboxIdx >= 0 && isImage && imgItems.length > 0 && (<Lightbox items={imgItems} index={lightboxIdx} onClose={() => setLightboxIdx(-1)} />)}
      {videoLightbox && data.generatedVideo?.url && (<Lightbox items={[{ url: data.generatedVideo.url, type: 'video' }]} index={0} onClose={() => setVideoLightbox(false)} />)}

      <Handle type="source" position={Position.Right} id={HANDLE_IDS.source} style={{ background: isImage ? '#e94560' : '#0f3460', border: '2px solid #1e1e32', width: 12, height: 12, top: '75%' }} />
      <div className="handle-label handle-label-right" style={{top:'75%',marginTop:-8}}>{isImage ? '图片输出' : '视频输出'}</div>
    </div>
  )
})
