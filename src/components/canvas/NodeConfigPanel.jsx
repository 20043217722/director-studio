import { useCanvasStore } from './utils/canvasStore'
import { AGENT_MODES, IMAGE_MODELS, VIDEO_MODELS } from './utils/nodeDefaults'

const TYPE_ICONS = {
  textPrompt: '📝', imageGen: '🎨', videoGen: '🎬',
  reference: '🖼️', preview: '👁️', agent: '🧠',
}

export function NodeConfigPanel() {
  const { selectedNodeId, nodes, updateNodeData, deleteNode, deselectNode } = useCanvasStore()
  if (!selectedNodeId) return null

  const node = nodes.find((n) => n.id === selectedNodeId)
  if (!node) return null

  const { data, type } = node
  const icon = TYPE_ICONS[type] || '📦'

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 10,
      width: 260, maxHeight: 'calc(100% - 80px)', overflowY: 'auto',
      background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
      border: '1px solid var(--glass-border)', borderRadius: 10, padding: 14,
      animation: 'slideUp 0.2s var(--ease-out)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          {icon} {data.label || type}
        </span>
        <button onClick={deselectNode} style={{
          background: 'transparent', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 16, lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Label (all types) */}
      <Field label="名称">
        <input value={data.label || ''} onChange={(e) => updateNodeData(selectedNodeId, { label: e.target.value })}
          className="config-input" />
      </Field>

      {/* Agent mode selector */}
      {type === 'agent' && (
        <Field label="智能体">
          <select value={data.agentMode || 'director'}
            onChange={(e) => updateNodeData(selectedNodeId, { agentMode: e.target.value, response: '', status: 'idle' })}
            className="config-input">
            {AGENT_MODES.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </Field>
      )}

      {/* Image model */}
      {type === 'imageGen' && (
        <>
          <Field label="模型">
            <select value={data.modelProvider || 'openai'}
              onChange={(e) => updateNodeData(selectedNodeId, { modelProvider: e.target.value })}
              className="config-input">
              {IMAGE_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </Field>
          <Field label="比例">
            <select value={data.aspectRatio || '1:1'}
              onChange={(e) => updateNodeData(selectedNodeId, { aspectRatio: e.target.value })}
              className="config-input">
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
            </select>
          </Field>
          <Field label="负面提示词">
            <input value={data.negativePrompt || ''} placeholder="不想要的元素..."
              onChange={(e) => updateNodeData(selectedNodeId, { negativePrompt: e.target.value })}
              className="config-input" />
          </Field>
        </>
      )}

      {/* Video model */}
      {type === 'videoGen' && (
        <>
          <Field label="模型">
            <select value={data.modelProvider || 'seedance'}
              onChange={(e) => updateNodeData(selectedNodeId, { modelProvider: e.target.value })}
              className="config-input">
              {VIDEO_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </Field>
          {(() => {
            const model = VIDEO_MODELS.find((m) => m.id === data.modelProvider)
            const [minS, maxS] = model?.durationRange || [3, 15]
            return (
              <Field label={`时长 (${minS}-${maxS}s)`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="range" min={minS} max={maxS} step={1}
                    value={data.duration || 5}
                    onChange={(e) => updateNodeData(selectedNodeId, { duration: parseInt(e.target.value) })}
                    style={{ flex: 1 }} />
                  <input type="number" min={minS} max={maxS}
                    value={data.duration || 5}
                    onChange={(e) => {
                      const v = Math.max(minS, Math.min(maxS, parseInt(e.target.value) || 5))
                      updateNodeData(selectedNodeId, { duration: v })
                    }}
                    style={{ width: 44, textAlign: 'center', fontSize: 12, padding: '4px',
                      borderRadius: 4, border: '1px solid var(--border)',
                      background: 'var(--bg-root)', color: 'var(--text)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>s</span>
                </div>
              </Field>
            )
          })()}
        </>
      )}

      {/* Status */}
      <Field label="状态">
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: data.status === 'done' ? 'var(--accent)'
            : data.status === 'error' ? '#ef4444'
            : data.status === 'generating' ? 'var(--brand)'
            : 'var(--text-muted)',
        }}>
          {data.status === 'generating' ? '⏳ 生成中' : data.status === 'done' ? '✅ 完成' : data.status === 'error' ? '❌ 错误' : '⏸ 待机'}
        </span>
      </Field>

      {data.status === 'error' && (
        <Field label="错误信息">
          <span style={{ fontSize: 11, color: '#ef4444' }}>{data.errorMessage}</span>
        </Field>
      )}

      {/* Delete */}
      <button onClick={() => { deleteNode(selectedNodeId) }} style={{
        width: '100%', marginTop: 12, padding: '8px',
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
