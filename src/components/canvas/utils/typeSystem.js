// Canvas Type System — isolated from nodeDefaults to avoid module init ordering issues
export const DATA_TYPES = {
  TEXT:    { label: '文本',   color: '#6c63ff', icon: 'T', shape: 'circle' },
  IMAGE:   { label: '图片',   color: '#e94560', icon: 'I', shape: 'circle' },
  VIDEO:   { label: '视频',   color: '#0f3460', icon: 'V', shape: 'circle' },
  PROMPT:  { label: '提示词', color: '#8b5cf6', icon: 'P', shape: 'circle' },
  INT:     { label: '整数',   color: '#22c55e', icon: '#', shape: 'diamond' },
  FLOAT:   { label: '浮点',   color: '#06b6d4', icon: 'f', shape: 'diamond' },
  BOOL:    { label: '布尔',   color: '#f97316', icon: '?', shape: 'diamond' },
  SEED:    { label: '种子',   color: '#f5c518', icon: 'S', shape: 'diamond' },
}

export const HANDLE_TYPES = {
  textPrompt: { inputs: { prompt: 'TEXT' }, outputs: { output: 'TEXT', negative: 'TEXT' } },
  mediaGen:   { inputs: { prompt: 'TEXT', image: 'IMAGE', negative: 'TEXT', seed: 'SEED', steps: 'INT' }, outputs: { output: 'IMAGE' } },
  imageGen:   { inputs: { prompt: 'TEXT', image: 'IMAGE', seed: 'SEED' }, outputs: { output: 'IMAGE' } },
  videoGen:   { inputs: { prompt: 'TEXT', image: 'IMAGE', seed: 'SEED' }, outputs: { output: 'VIDEO' } },
  agent:      { inputs: { prompt: 'TEXT' }, outputs: { output: 'TEXT' } },
  reference:  { inputs: {}, outputs: { output: 'IMAGE' } },
  preview:    { inputs: { input: 'IMAGE' }, outputs: { output: 'IMAGE' } },
  reroute:    { inputs: { input: 'TEXT' }, outputs: { output: 'TEXT' } },
  primitive:  { inputs: {}, outputs: { output: 'TEXT' } },
  pixelleVideo: { inputs: { prompt: 'TEXT' }, outputs: { output: 'VIDEO' } },
}

export const TYPE_COMPAT = {
  TEXT:  ['TEXT', 'PROMPT'],
  IMAGE: ['IMAGE', 'VIDEO'],
  VIDEO: ['VIDEO', 'IMAGE'],
  PROMPT: ['TEXT', 'PROMPT'],
  INT:   ['INT', 'FLOAT', 'SEED'],
  FLOAT: ['FLOAT', 'INT'],
  SEED:  ['SEED', 'INT'],
  BOOL:  ['BOOL'],
}

export function validateHandleTypes(sourceNode, sourceHandle, targetNode, targetHandle) {
  const srcType = HANDLE_TYPES[sourceNode.type]?.outputs?.[sourceHandle]
  const tgtType = HANDLE_TYPES[targetNode.type]?.inputs?.[targetHandle]
  if (!srcType || !tgtType) return { valid: true }
  if (TYPE_COMPAT[srcType]?.includes(tgtType)) return { valid: true }
  return { valid: false, reason: '类型不匹配: ' + (DATA_TYPES[srcType]?.label || srcType) + ' -> ' + (DATA_TYPES[tgtType]?.label || tgtType) }
}
