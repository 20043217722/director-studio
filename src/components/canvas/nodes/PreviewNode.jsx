import { memo, useState, useCallback } from 'react'
import { useCanvasStore } from '../utils/canvasStore'
import { Handle, Position } from '@xyflow/react'
import Lightbox from '../Lightbox'

/** Drag image from preview to create a ReferenceNode on canvas */
function onImageDragStart(e, content) {
  const url = typeof content === 'string' ? content : content?.url
  if (!url) return
  e.dataTransfer.setData('application/canvas-image', JSON.stringify({
    url, type: 'image', name: 'Preview Image',
  }))
  e.dataTransfer.effectAllowed = 'copy'
}

export const PreviewNode = memo(({ id, data }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [videoFull, setVideoFull] = useState(false)

  const imageUrl = data.outputType === 'image' && data.outputContent
    ? (typeof data.outputContent === 'string' ? data.outputContent : data.outputContent.url)
    : null
  const videoUrl = data.outputType === 'video' && data.outputContent?.url
    ? data.outputContent.url : null

  const hasContent = !!(imageUrl || videoUrl || data.response)

  return (
    <div className="canvas-node preview-node" style={{ minWidth: 260, maxWidth: 420 }}>
      <Handle type="target" position={Position.Left} id="input"
        style={{ background: 'var(--brand)', border: '2px solid var(--bg-surface)', width: 12, height: 12 }} />
      <Handle type="source" position={Position.Right} id="output"
        style={{ background: 'var(--brand)', border: '2px solid var(--bg-surface)', width: 12, height: 12 }} />

      {/* --- Header --- */}
      <div className="node-header" style={{ borderLeftColor: 'var(--brand)', justifyContent: 'space-between' }}>
        <span>👁️ {data.label}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color:
          data.status === 'done' || hasContent ? 'var(--success)' :
          data.status === 'error' ? '#ef4444' :
          data.status === 'generating' ? 'var(--brand)' : 'var(--text-muted)' }}>
          {data.status === 'generating' ? '⏳生成中' :
           data.status === 'error' ? '❌错误' :
           hasContent ? '✅就绪' : '等待输入'}
        </span>
      </div>

      {/* --- Body --- */}
      <div className="node-body">
        {/* Generating animation */}
        {data.status === 'generating' && !hasContent && (
          <div className="loading-dots">
            <span className="loading-dot" />
            <span className="loading-dot" style={{ animationDelay: '0.2s' }} />
            <span className="loading-dot" style={{ animationDelay: '0.4s' }} />
          </div>
        )}

        {/* Image preview */}
        {imageUrl && (
          <div className="preview-media-wrap">
            <img src={imageUrl} alt="Preview"
              className="preview-img" onClick={() => setLightboxOpen(true)}
              draggable onDragStart={(e) => onImageDragStart(e, data.outputContent)}
              style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 6, cursor: 'pointer' }} />
            <div className="media-actions">
              <button className="img-action-btn" onClick={() => setLightboxOpen(true)} title="放大查看">🔍</button>
              <button className="img-action-btn" title="拖出为节点"
                draggable onDragStart={(e) => onImageDragStart(e, data.outputContent)}
                style={{ cursor: 'grab' }}>⚡</button>
              <a href={imageUrl} download target="_blank" rel="noreferrer"
                className="img-action-btn" style={{ textDecoration: 'none' }} title="下载">⬇</a>
            </div>
          </div>
        )}

        {/* Video preview */}
        {videoUrl && (
          <div className="preview-media-wrap">
            <video src={videoUrl} controls
              className="preview-video"
              style={{ width: '100%', maxHeight: videoFull ? 500 : 220, borderRadius: 6, background: '#000', transition: 'max-height 0.3s' }} />
            <div className="media-actions">
              <button className="img-action-btn"
                onClick={() => setVideoFull(!videoFull)} title="切换大小">
                {videoFull ? '🔽' : '🔼'}
              </button>
              <a href={videoUrl} download target="_blank" rel="noreferrer"
                className="img-action-btn" style={{ textDecoration: 'none' }} title="下载">⬇</a>
            </div>
          </div>
        )}

        {/* Text response */}
        {data.response && !imageUrl && !videoUrl && (
          <div className="preview-text">
            {data.response.slice(0, 800)}{data.response.length > 800 && '...'}
          </div>
        )}

        {/* Error */}
        {data.status === 'error' && (
          <div className="node-error">{data.errorMessage}</div>
        )}

        {/* Empty state */}
        {!hasContent && data.status !== 'generating' && data.status !== 'error' && (
          <div className="preview-empty">
            <span style={{ fontSize: 24 }}>🔗</span>
            <span>连接生成节点，数据自动流转</span>
          </div>
        )}

        {/* Feedback action buttons — creator quick actions */}
        {hasContent && data.status !== 'generating' && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.dispatchEvent(new CustomEvent('preview-retry', { detail: { previewId: id } }))
              }}
              title="触发上游节点重新生成"
              style={{
                flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600,
                borderRadius: 4, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >🔄 重新生成</button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const s = useCanvasStore.getState()
                const upstreamIds = s.edges.filter(edge => edge.target === id).map(edge => edge.source)
                const upstreamNode = upstreamIds.length > 0 ? s.nodes.find(n => n.id === upstreamIds[0]) : null
                const pos = {
                  x: upstreamNode ? upstreamNode.position.x + 360 : 300,
                  y: upstreamNode ? upstreamNode.position.y - 80 : 200,
                }
                s.addNode('agent', pos)
                const newNode = s.nodes[s.nodes.length - 1]
                if (newNode) {
                  s.updateNodeData(newNode.id, {
                    agentMode: 'lens',
                    prompt: '分析这张生成结果，指出画面问题和改进方向，输出优化后的提示词',
                  })
                  const now = Date.now()
                  s.setState({
                    edges: [...s.edges, {
                      id: 'e_pv_analysis_' + now,
                      source: id, sourceHandle: 'output',
                      target: newNode.id, targetHandle: 'prompt',
                      type: 'smoothstep', animated: true,
                      style: { stroke: 'var(--brand)', strokeWidth: 3, strokeLinecap: 'round' },
                    }],
                  })
                }
              }}
              title="创建视觉解析师分析生成结果"
              style={{
                flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600,
                borderRadius: 4, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >🔍 智能体分析</button>
          </div>
        )}
      </div>

      {/* --- Lightbox --- */}
      {lightboxOpen && imageUrl && (
        <Lightbox items={[{ url: imageUrl, type: 'image', name: 'Preview' }]} index={0}
          onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  )
})
