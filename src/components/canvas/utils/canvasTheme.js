// Canvas theme — libtv-level visual design system
export const NODE_COLORS = {
  textPrompt:  { bg: '#1a1a2e', border: '#6c63ff', glow: 'rgba(108,99,255,0.12)', gradient: 'linear-gradient(135deg, #6c63ff22, #1a1a2e)', icon: '#6c63ff' },
  imageGen:    { bg: '#1a1a2e', border: '#e94560', glow: 'rgba(233,69,96,0.12)',  gradient: 'linear-gradient(135deg, #e9456022, #1a1a2e)', icon: '#e94560' },
  videoGen:    { bg: '#1a1a2e', border: '#0f3460', glow: 'rgba(15,52,96,0.12)',   gradient: 'linear-gradient(135deg, #0f346022, #1a1a2e)', icon: '#0f3460' },
  agent:       { bg: '#1a1a2e', border: '#f5c518', glow: 'rgba(245,197,24,0.15)', gradient: 'linear-gradient(135deg, #f5c51822, #1a1a2e)', icon: '#f5c518' },
  mediaGen:    { bg: '#1a1a2e', border: '#8b5cf6', glow: 'rgba(139,92,246,0.12)',  gradient: 'linear-gradient(135deg, #8b5cf622, #1a1a2e)', icon: '#8b5cf6' },
  reference:   { bg: '#1a1a2e', border: '#4ade80', glow: 'rgba(74,222,128,0.10)',  gradient: 'linear-gradient(135deg, #4ade8022, #1a1a2e)', icon: '#4ade80' },
  preview:     { bg: '#1a1a2e', border: '#38bdf8', glow: 'rgba(56,189,248,0.10)',  gradient: 'linear-gradient(135deg, #38bdf822, #1a1a2e)', icon: '#38bdf8' },
  pixelleVideo:{ bg: '#1a1a2e', border: '#f472b6', glow: 'rgba(244,114,182,0.12)', gradient: 'linear-gradient(135deg, #f472b622, #1a1a2e)', icon: '#f472b6' },
}

export const STATUS_COLORS = {
  idle:    '#666',
  running: '#f5c518',
  success: '#4ade80',
  error:   '#e94560',
}

export const nodeStyle = (type, status = 'idle') => ({
  background: NODE_COLORS[type]?.bg || '#1a1a2e',
  border: `1.5px solid ${NODE_COLORS[type]?.border || '#333'}`,
  borderRadius: '10px',
  padding: 0,
  boxShadow: `0 0 12px ${NODE_COLORS[type]?.glow || 'transparent'}`,
  minWidth: 220,
  maxWidth: 420,
  fontFamily: 'system-ui, sans-serif',
  overflow: 'hidden',
})

export const nodeHeaderStyle = (type) => ({
  background: NODE_COLORS[type]?.gradient || '#1a1a2e',
  padding: '8px 14px',
  borderBottom: `1px solid ${NODE_COLORS[type]?.border || '#333'}33`,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: NODE_COLORS[type]?.icon || '#fff',
})

export const statusDotStyle = (status) => ({
  width: 8, height: 8, borderRadius: '50%',
  background: STATUS_COLORS[status] || STATUS_COLORS.idle,
  boxShadow: `0 0 6px ${STATUS_COLORS[status] || STATUS_COLORS.idle}`,
  flexShrink: 0,
})

// Edge styling — color-coded by data flow type
export const edgeColors = {
  prompt:    '#6c63ff',
  image:     '#e94560',
  video:     '#0f3460',
  agent:     '#f5c518',
  media:     '#8b5cf6',
  reference: '#4ade80',
}

export function getEdgeStyle(sourceType, targetType) {
  // Default to a subtle style
  return {
    stroke: NODE_COLORS[sourceType]?.border || '#555',
    strokeWidth: 2,
    animated: true,
  }
}
