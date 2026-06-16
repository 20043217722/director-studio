import { memo, useState, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'
import { IMAGE_MODELS } from '../utils/nodeDefaults'

function useModelKeys() {
  return useMemo(() => {
    try {
      const keys = JSON.parse(localStorage.getItem('api_keys') || '{}')
      return new Set(Object.keys(keys))
    } catch { return new Set() }
  }, [])
}

export const ImageGenNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [genLoading, setGenLoading] = useState(false)
  const userKeys = useModelKeys()

  const handleGenerate = async () => {
    if (!data.prompt) return
    setGenLoading(true)
    updateNodeData(id, { status: 'generating', errorMessage: '' })
    try {
      const { generateImage } = await import('../../../lib/canvasApi')
      const result = await generateImage(data.prompt, {
        provider: data.modelProvider,
        aspectRatio: data.aspectRatio,
        count: data.imageCount,
      })
      updateNodeData(id, {
        generatedImages: result.images || [],
        status: 'done',
      })
    } catch (e) {
      updateNodeData(id, { status: 'error', errorMessage: e.message })
    } finally {
      setGenLoading(false)
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

        {/* Generate button */}
        <button
          className="node-btn"
          onClick={handleGenerate}
          disabled={genLoading || !data.prompt}
          style={{
            background: 'var(--accent-music)', color: '#fff',
            opacity: (genLoading || !data.prompt) ? 0.5 : 1,
          }}
        >
          {genLoading ? '⏳ 生成中...' : '🎨 生成图片'}
        </button>

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
