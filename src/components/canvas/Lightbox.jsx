import { useEffect, useCallback, useState } from 'react'

/**
 * Lightbox — fullscreen image/video viewer for canvas nodes.
 * Props:
 *   items: [{ url, type: 'image'|'video', name? }]
 *   index: starting index
 *   onClose: close callback
 */
export default function Lightbox({ items = [], index = 0, onClose }) {
  const [idx, setIdx] = useState(index)
  const item = items[idx]

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Arrow key navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(items.length - 1, i + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items.length])

  const handleDownload = useCallback(() => {
    if (!item?.url) return
    const a = document.createElement('a')
    a.href = item.url
    a.download = item.name || 'download'
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [item])

  if (!item) return null

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      {/* Close button */}
      <button className="lightbox-close" onClick={onClose} title="关闭 (Esc)">
        ✕
      </button>

      {/* Download button */}
      <button className="lightbox-download" onClick={handleDownload} title="下载">
        ⬇
      </button>

      {/* Counter */}
      {items.length > 1 && (
        <div className="lightbox-counter">
          {idx + 1} / {items.length}
        </div>
      )}

      {/* Prev / Next arrows */}
      {idx > 0 && (
        <button className="lightbox-arrow lightbox-arrow-left" onClick={(e) => { e.stopPropagation(); setIdx(idx - 1) }}>
          ‹
        </button>
      )}
      {idx < items.length - 1 && (
        <button className="lightbox-arrow lightbox-arrow-right" onClick={(e) => { e.stopPropagation(); setIdx(idx + 1) }}>
          ›
        </button>
      )}

      {/* Content */}
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {item.type === 'image' ? (
          <img src={item.url} alt={item.name || ''} className="lightbox-img" />
        ) : item.type === 'video' ? (
          <video src={item.url} controls autoPlay className="lightbox-video" />
        ) : null}
      </div>
    </div>
  )
}
