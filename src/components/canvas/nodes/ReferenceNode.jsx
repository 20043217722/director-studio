import { memo, useCallback, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'

function compressImage(file) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); return }
    const img = new Image(); const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); const MAX = 1024; let { width, height } = img
      if (width > MAX || height > MAX) { const ratio = Math.min(MAX / width, MAX / height); width = Math.round(width * ratio); height = Math.round(height * ratio) }
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob) }, 'image/jpeg', 0.8) }
    img.src = url
  })
}

export const ReferenceNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(async (file) => {
    const isImage = file.type.startsWith('image/'); const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) return
    const base64 = await compressImage(file)
    updateNodeData(id, { mediaType: isImage ? 'image' : 'video', mediaData: base64, fileName: file.name })
  }, [id, updateNodeData])

  const onDrop = useCallback((e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) handleFile(file) }, [handleFile])
  const onPaste = useCallback((e) => { const items = e.clipboardData?.items; if (items) { for (const item of items) { if (item.type.startsWith('image/')) { handleFile(item.getAsFile()); break } } } }, [handleFile])

  return (
    <div className="canvas-node" style={{borderColor:'#4ade8040'}} onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onPasteCapture={onPaste}>
      <div className="node-header">
        <span className="node-icon">参考</span>
        <span className="node-title">{data.label || '参考素材'}</span>
      </div>
      <div className="node-body">
        {data.mediaData ? (
          <div className="node-preview">
            {data.mediaType === 'image' ? (<img src={data.mediaData} alt={data.fileName} />) : (<video src={data.mediaData} controls style={{maxHeight:140}} />)}
            <div style={{fontSize:10, color:'#666', textAlign:'center', marginTop:4}}>{data.fileName}</div>
          </div>
        ) : (
          <div className="node-preview-placeholder">
            <span className="ph-icon">[ ]</span>
            <span>拖拽图片/视频到此处</span>
            <span style={{fontSize:10,color:'#444'}}>或 Ctrl+V 粘贴</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="output" style={{ background: '#4ade80', border: '2px solid #1e1e32', width: 12, height: 12 }} />
    </div>
  )
})
