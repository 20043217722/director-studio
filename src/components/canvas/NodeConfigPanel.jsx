import { useEffect, useRef } from 'react'
import { useCanvasStore } from './utils/canvasStore'
import { AGENT_MODES, IMAGE_MODELS, VIDEO_MODELS } from './utils/nodeDefaults'
import { animatePanelEnter } from '../../lib/canvasAnimations'

const TYPE_ICONS = { textPrompt: '📝', imageGen: '🎨', videoGen: '🎬', mediaGen: '🎨', reference: '🖼️', preview: '👁️', agent: '🧠', pixelleVideo: '🎞️' }

export function NodeConfigPanel() {
  const { selectedNodeId, nodes, updateNodeData, deleteNode, deselectNode } = useCanvasStore()
  const panelRef = useRef(null)
  useEffect(() => { if (selectedNodeId && panelRef.current) animatePanelEnter(panelRef.current) }, [selectedNodeId])
  if (!selectedNodeId) return null

  const node = nodes.find((n) => n.id === selectedNodeId)
  if (!node) return null

  const { data, type } = node
  const icon = TYPE_ICONS[type] || '📦'
  const isGen = type === 'imageGen' || type === 'videoGen' || type === 'mediaGen'
  const isMediaGen = type === 'mediaGen'

  return (
    <div className="config-panel" ref={panelRef} style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 9,
      width: 300, overflowY: 'auto',
      background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
      borderLeft: '1px solid var(--glass-border)', padding: 14,
      animation: 'slideInRight 0.2s ease',
    }}>
      {/* Header */}
      <div className="config-panel-header">
        <span>{icon} {data.label || type}</span>
        <button onClick={deselectNode} className="config-close-btn">✕</button>
      </div>

      {/* Media Preview (for gen nodes) */}
      {isGen && (
        <div className="config-preview">
          {data.generatedImages?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {data.generatedImages.map((img, i) => (
                <img key={i} src={img.url || img.base64} alt=""
                  style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 6, background: 'var(--bg-root)' }} />
              ))}
            </div>
          )}
          {data.generatedVideo?.url && (
            <video src={data.generatedVideo.url} controls
              style={{ width: '100%', maxHeight: 200, borderRadius: 6, background: '#000' }} />
          )}
          {data.status === 'generating' && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
              <div className="loading-dot" style={{ display: 'inline-block', margin: '0 2px' }} />
              <div className="loading-dot" style={{ display: 'inline-block', margin: '0 2px', animationDelay: '0.2s' }} />
              <div className="loading-dot" style={{ display: 'inline-block', margin: '0 2px', animationDelay: '0.4s' }} />
              <div style={{ fontSize: 11, marginTop: 6 }}>生成中...</div>
            </div>
          )}
        </div>
      )}

      {/* Label */}
      <Field label="名称">
        <input value={data.label || ''} onChange={(e) => updateNodeData(selectedNodeId, { label: e.target.value })}
          className="config-input" />
      </Field>

      {/* Prompt textarea (for textPrompt, imageGen, videoGen, mediaGen, agent, pixelleVideo) */}
      {(type === 'textPrompt' || type === 'imageGen' || type === 'videoGen' || type === 'mediaGen' || type === 'agent' || type === 'pixelleVideo') && (
        <Field label={type === 'textPrompt' ? '提示词' : '创作指令'}>
          <textarea
            value={data.prompt || ''}
            onChange={(e) => updateNodeData(selectedNodeId, { prompt: e.target.value })}
            rows={type === 'textPrompt' ? 6 : 4}
            className="config-textarea"
            placeholder={type === 'textPrompt' ? '输入创作指令...' : '描述你想生成的内容...'}
          />
        </Field>
      )}

      {/* Agent mode */}
      {type === 'agent' && (
        <Field label="智能体">
          <select value={data.agentMode || 'director'}
            onChange={(e) => updateNodeData(selectedNodeId, { agentMode: e.target.value, response: '', status: 'idle' })}
            className="config-input">
            {AGENT_MODES.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </Field>
      )}

      {/* ImageGen / MediaGen image mode */}
      {(type === 'imageGen' || (isMediaGen && data.mediaType !== 'video')) && (
        <>
          <Field label="模型">
            <select value={data.modelProvider || 'gpt-image-1'}
              onChange={(e) => updateNodeData(selectedNodeId, { modelProvider: e.target.value })}
              className="config-input">
              {IMAGE_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </Field>
          <Field label="比例">
            <div style={{ display: 'flex', gap: 4 }}>
              {['1:1', '16:9', '9:16', '1024x1024', '1792x1024', '1024x1792'].map((s) => (
                <button key={s} className="node-pill" style={{
                  flex: 1, fontSize: 10,
                  background: data.aspectRatio === s ? 'var(--accent-music)' : 'var(--bg-root)',
                  color: data.aspectRatio === s ? '#fff' : 'var(--text-dim)',
                }} onClick={() => updateNodeData(selectedNodeId, { aspectRatio: s })}>{s}</button>
              ))}
            </div>
          </Field>
        </>
      )}

      {/* VideoGen / MediaGen video mode */}
      {(type === 'videoGen' || (isMediaGen && data.mediaType === 'video')) && (
        <>
          <Field label="模型">
            <select value={data.modelProvider || 'sora'}
              onChange={(e) => updateNodeData(selectedNodeId, { modelProvider: e.target.value })}
              className="config-input">
              {VIDEO_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </Field>
          <Field label={`时长 (${data.duration || 5}s)`}>
            <div className="duration-control">
              <input type="range" min={3} max={15} step={1}
                value={data.duration || 5}
                onChange={(e) => updateNodeData(selectedNodeId, { duration: parseInt(e.target.value) })}
                style={{ flex: 1 }} />
              <input type="number" min={3} max={15}
                value={data.duration || 5}
                onChange={(e) => updateNodeData(selectedNodeId, { duration: parseInt(e.target.value) || 5 })}
                style={{ width: 40, textAlign: 'center', fontSize: 11, padding: '3px',
                  borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--bg-root)', color: 'var(--text)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>s</span>
            </div>
          </Field>
        </>
      )}

      {/* MediaGen type toggle */}
      {isMediaGen && (
        <Field label="媒体类型">
          <div className="media-tabs">
            <button className={`media-tab ${data.mediaType !== 'video' ? 'active' : ''}`}
              onClick={() => updateNodeData(selectedNodeId, { mediaType: 'image' })}>🎨 生图</button>
            <button className={`media-tab ${data.mediaType === 'video' ? 'active' : ''}`}
              onClick={() => updateNodeData(selectedNodeId, { mediaType: 'video' })}>🎬 生视频</button>
          </div>
        </Field>
      )}

      {/* Status */}
      <Field label="状态">
        <span style={{ fontSize: 11, fontWeight: 600, color:
          data.status === 'done' ? 'var(--success)' :
          data.status === 'error' ? '#ef4444' :
          data.status === 'generating' ? 'var(--brand)' : 'var(--text-muted)' }}>
          {data.status === 'generating' ? '⏳ 生成中' :
           data.status === 'done' ? '✅ 完成' :
           data.status === 'error' ? '❌ 错误' : '⏸ 待机'}
        </span>
      </Field>

      {data.status === 'error' && (
        <div className="node-error" style={{ marginBottom: 10 }}>{data.errorMessage}</div>
      )}

      {/* Delete */}
      <button onClick={() => { deleteNode(selectedNodeId) }} style={{
        width: '100%', padding: '8px', marginTop: 8,
        background: 'transparent', color: '#ef4444',
        border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6,
        fontSize: 12, cursor: 'pointer', fontWeight: 600,
      }}>🗑️ 删除节点</button>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="config-field">
      <label className="config-label">{label}</label>
      {children}
    </div>
  )
}
