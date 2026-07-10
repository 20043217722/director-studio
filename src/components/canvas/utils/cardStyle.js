// ===== libtv-style Card Layout System =====
// Shared card layout utilities for all canvas nodes

import { NODE_COLORS, STATUS_COLORS, statusDotStyle } from './canvasTheme';

// Card header component props
export function cardHeader(type, label, status, inputCount = 0) {
  const c = NODE_COLORS[type] || NODE_COLORS.agent
  return {
    background: c.gradient,
    padding: '8px 14px',
    borderBottom: '1px solid ' + c.border + '33',
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: 13, fontWeight: 600, color: c.icon,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }
}

// Card body props
export function cardBody() {
  return {
    padding: '10px 14px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  }
}

// Card footer props
export function cardFooter() {
  return {
    padding: '8px 14px',
    borderTop: '1px solid #ffffff08',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '8px',
  }
}

// Generate button style
export function genButtonStyle(type, disabled = false) {
  const c = NODE_COLORS[type] || NODE_COLORS.agent
  return {
    padding: '5px 14px', borderRadius: 6, border: 'none',
    background: disabled ? '#333' : c.border,
    color: disabled ? '#666' : '#fff',
    fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s',
  }
}

// Textarea style
export function textareaStyle() {
  return {
    width: '100%', minHeight: 60, maxHeight: 200,
    padding: '8px 10px', borderRadius: 6,
    border: '1px solid #333', background: '#111',
    color: '#eee', fontSize: 12, lineHeight: 1.5,
    resize: 'vertical', outline: 'none',
    fontFamily: 'system-ui, sans-serif',
  }
}

// Section label style
export function sectionLabel() {
  return {
    fontSize: 11, fontWeight: 600, color: '#888',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: 2,
  }
}

// Inline preview style
export function previewContainer() {
  return {
    width: '100%', maxHeight: 200, overflow: 'hidden',
    borderRadius: 6, border: '1px solid #333',
    background: '#0a0a0a', position: 'relative',
  }
}
