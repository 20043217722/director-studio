import { memo, useCallback, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'

/** Compress image to max 1024px, JPEG quality 0.8 → typically reduces 10MB→200KB */
function compressImage(file) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      // Video or other — read directly without compression
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(file)
      return
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1024
      let { width, height } = img
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      }, 'image/jpeg', 0.8)
    }
    img.src = url
  })
}

export const ReferenceNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(async (file) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) return

    const base64 = await compressImage(file)

    updateNodeData(id, {
      mediaType: isImage ? 'image' : 'video',
      mediaData: base64,
      fileName: file.name,
    })
  }, [id, updateNodeData])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onPaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          handleFile(item.getAsFile())
          break
        }
      }
    }
  }, [handleFile])

  return (
    <div className="canvas-node" style={{ minWidth: 200 }}
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onPasteCapture={onPaste}
    >
      <div className="node-header" style={{ borderLeftColor: 'var(--accent-clone)' }}>
        <span>🖼️ {data.label}</span>
      </div>
      <div className="node-body">
        {data.mediaData ? (
          <div>
            {data.mediaType === 'image' ? (
              <img src={data.mediaData} alt={data.fileName}
                style={{ width: '100%', borderRadius: 4, maxHeight: 160, objectFit: 'cover' }} />
            ) : (
              <video src={data.mediaData} controls style={{ width: '100%', borderRadius: 4, maxHeight: 120 }} />
            )}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
              {data.fileName}
            </div>
          </div>
        ) : (
          <div style={{
            border: `2px dashed ${dragOver ? 'var(--accent-clone)' : 'var(--border)'}`,
            borderRadius: 8, padding: '20px 12px', textAlign: 'center',
            color: 'var(--text-muted)', fontSize: 12, transition: 'border-color 0.2s',
            background: dragOver ? 'rgba(219,39,119,0.05)' : 'transparent',
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
            拖拽图片/视频<br />或 Ctrl+V 粘贴
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="output"
        style={{ background: 'var(--accent-clone)', border: '2px solid var(--bg-surface)', width: 12, height: 12 }} />
    </div>
  )
})
