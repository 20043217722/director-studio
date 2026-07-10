import { memo, useState, useCallback } from 'react'
import { useCanvasStore } from '../utils/canvasStore'
import { Handle, Position } from '@xyflow/react'
import Lightbox from '../Lightbox'

function onImageDragStart(e, content) {
  const url = typeof content === 'string' ? content : content?.url
  if (!url) return
  e.dataTransfer.setData('application/canvas-image', JSON.stringify({ url, type: 'image', name: '预览图片' }))
  e.dataTransfer.effectAllowed = 'copy'
}

export const PreviewNode = memo(({ id, data }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [videoFull, setVideoFull] = useState(false)

  const imageUrl = data.outputType === 'image' && data.outputContent ? (typeof data.outputContent === 'string' ? data.outputContent : data.outputContent.url) : null
  const videoUrl = data.outputType === 'video' && data.outputContent?.url ? data.outputContent.url : null
  const hasContent = !!(imageUrl || videoUrl || data.response)

  const handleRetry = useCallback((e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('preview-retry', { detail: { previewId: id } })) }, [id])
  const handleAnalyze = useCallback((e) => {
    e.stopPropagation()
    const s = useCanvasStore.getState()
    const pos = { x: 300, y: 200 }
    s.addNode('agent', pos)
    const newNode = s.nodes[s.nodes.length - 1]
    if (newNode) {
      s.updateNodeData(newNode.id, { agentMode: 'lens', prompt: '分析这张生成结果，指出画面问题和改进方向，输出优化后的提示词' })
      s.setState({ edges: [...s.edges, { id: 'e_pv_' + Date.now(), source: id, sourceHandle: 'output', target: newNode.id, targetHandle: 'prompt', type: 'default', animated: true, style: { stroke: '#6c63ff', strokeWidth: 3, strokeLinecap: 'round' } }] })
    }
  }, [id])

  return (
    <div className={canvas-node} style={{borderColor:'#38bdf840'}}>
      <Handle type="target" position={Position.Left} id="input" style={{ background: '#38bdf8', border: '2px solid #1e1e32', width: 12, height: 12 }} />
      <div className='handle-label handle-label-left' style={{top:'50%',marginTop:-8}}>输入</div>
      <Handle type="source" position={Position.Right} id="output" style={{ background: '#38bdf8', border: '2px solid #1e1e32', width: 12, height: 12 }} />
      <div className='handle-label handle-label-right' style={{top:'50%',marginTop:-8}}>输出</div>

      <div className="node-header">
        <div className='node-header-accent preview' /><span className='node-icon'>预览</span>
        <span className="node-title">{data.label || '预览输出'}</span>
        <span className={'node-status ' + (hasContent ? 'done' : 'idle')}>{hasContent ? '完成' : '待输入'}</span>
      </div>

      <div className="node-body">
        {data.status === 'generating' && !hasContent && (<div className="loading-dots"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></div>)}

        {imageUrl && (
          <div className="node-preview">
            <img src={imageUrl} alt="" onClick={() => setLightboxOpen(true)} draggable onDragStart={(e) => onImageDragStart(e, data.outputContent)} />
            <div className="img-gallery-actions" style={{opacity:1}}>
              <button className="img-action-btn" onClick={() => setLightboxOpen(true)}>放大</button>
              <a href={imageUrl} download target="_blank" rel="noreferrer" className="img-action-btn" style={{textDecoration:'none'}}>下载</a>
            </div>
          </div>
        )}

        {videoUrl && (
          <div className="node-preview">
            <video src={videoUrl} controls />
            <div className="img-gallery-actions" style={{opacity:1}}>
              <button className="img-action-btn" onClick={() => setVideoFull(!videoFull)}>{videoFull ? '缩小' : '放大'}</button>
              <a href={videoUrl} download target="_blank" rel="noreferrer" className="img-action-btn" style={{textDecoration:'none'}}>下载</a>
            </div>
          </div>
        )}

        {data.response && !imageUrl && !videoUrl && (<div className="response-text">{data.response.slice(0, 500)}</div>)}
        {data.status === 'error' && <div className="node-error">{data.errorMessage}</div>}

        {!hasContent && data.status !== 'generating' && data.status !== 'error' && (
          <div className="preview-empty"><span>等待输入</span><span>连接上游节点，数据自动流转</span></div>
        )}

        {hasContent && data.status !== 'generating' && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button onClick={handleRetry} style={{ flex: 1, padding: '4px 0', fontSize: 10, borderRadius: 4, border: '1px solid #2a2a45', background: 'transparent', color: '#888', cursor: 'pointer' }}>重新生成</button>
            <button onClick={handleAnalyze} style={{ flex: 1, padding: '4px 0', fontSize: 10, borderRadius: 4, border: '1px solid #2a2a45', background: 'transparent', color: '#888', cursor: 'pointer' }}>智能体分析</button>
          </div>
        )}
      </div>

      {lightboxOpen && imageUrl && (<Lightbox items={[{ url: imageUrl, type: 'image', name: 'Preview' }]} index={0} onClose={() => setLightboxOpen(false)} />)}
    </div>
  )
})
