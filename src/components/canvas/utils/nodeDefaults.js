// Unified Handle IDs — single source of truth for all nodes and store logic
export const HANDLE_IDS = {
  source: 'output',
  target: { prompt: 'prompt', image: 'image', input: 'input' },
}

export const nodeDefaults = {
  textPrompt: {
    reroute: ['input'],
    label: '文本提示词', prompt: '',
  },
  imageGen: {
    reroute: ['input'],
    label: '图片生成', prompt: '', negativePrompt: '',
    modelProvider: 'openai', aspectRatio: '1:1', imageCount: 1,
    generatedImages: [], status: 'idle', errorMessage: '',
  },
  videoGen: {
    reroute: ['input'],
    label: '视频生成', prompt: '', sourceImage: null,
    modelProvider: 'seedance', duration: 5,
    progress: 0, generatedVideo: null, status: 'idle', errorMessage: '',
  },
  reference: {
    reroute: ['input'],
    label: '参考素材', mediaType: 'image', mediaData: null, fileName: '',
  },
  preview: {
    reroute: ['input'],
    label: '预览输出', outputType: 'image', outputContent: null,
    status: 'idle', errorMessage: '',
  },
  agent: {
    reroute: ['input'],
    label: 'AI 智能体', agentMode: 'director', prompt: '',
    response: '', status: 'idle', errorMessage: '',
  },
  pixelleVideo: {
    reroute: ['input'],
    label: 'AI 短视频', prompt: '', nScenes: 5,
    template: '1080x1920/image_default.html', tts: 'edge', bgm: 'uplift',
    progress: 0, generatedVideo: null, status: 'idle', errorMessage: '',
  },
  reroute: { label: '中继节点' },
  mediaGen: {
    reroute: ['input'], imageGen: ['prompt','image'], videoGen: ['prompt','image'],
    label: '媒体生成', prompt: '', mediaType: 'image',
    modelProvider: 'gpt-image-1', aspectRatio: '1:1', imageCount: 1,
    duration: 5, sourceImage: null,
    generatedImages: [], generatedVideo: null,
    status: 'idle', errorMessage: '', progress: 0,
  },
}

// Legacy → MediaGen aliases (for backward compatibility when loading old canvases)
export const NODE_ALIASES = {
  imageGen: 'mediaGen',
  videoGen: 'mediaGen',
}

// Valid connections
export const validConnections = {
  // 📝 文本提示词 → 万物之始
  textPrompt: {
    reroute: ['input'],
    imageGen: ['prompt'], videoGen: ['prompt'], agent: ['prompt'],
    pixelleVideo: ['prompt'], mediaGen: ['prompt'],
    textPrompt: ['prompt'],   // 链式提示
  },
  // 🎨 图片生成 → 下游
  imageGen: {
    reroute: ['input'],
    preview: ['input'], videoGen: ['image'], agent: ['prompt'],
    mediaGen: ['prompt', 'image'],
    textPrompt: ['prompt'],   // 图片结果→提示词迭代
  },
  // 🎬 视频生成 → 下游
  videoGen: {
    reroute: ['input'],
    preview: ['input'], mediaGen: ['prompt', 'image'],
    textPrompt: ['prompt'],
  },
  // 🖼️ 参考素材 → 下游
  reference: {
    reroute: ['input'],
    imageGen: ['prompt'], videoGen: ['image'], mediaGen: ['prompt', 'image'],
    textPrompt: ['prompt'], agent: ['prompt'],  // 图转文：参考图→提示词/智能体分析
  },
  // 👁️ 预览 → AI分析
  preview: {
    reroute: ['input'],
    agent: ['prompt'],         // 预览结果→AI分析
  },
  // 🧠 AI智能体 → 万物互联
  agent: {
    reroute: ['input'],
    preview: ['input'],
    textPrompt: ['prompt'],    // Agent响应→新提示词
    agent: ['prompt'],         // Agent链式协作
    imageGen: ['prompt'],      // Agent思路→生成图片
    videoGen: ['prompt'],      // Agent分镜→生成视频
    mediaGen: ['prompt'],      // Agent设计→媒体生成
  },
  // 🎞️ 短视频 → 预览
  pixelleVideo: {
    reroute: ['input'], preview: ['input'] },
  // 🔄 中继节点 → 万物通过
  reroute: {
    textPrompt: ['prompt'], imageGen: ['prompt'], videoGen: ['prompt'],
    mediaGen: ['prompt', 'image'], reference: ['prompt'], preview: ['input'],
    agent: ['prompt'], pixelleVideo: ['prompt'], reroute: ['input'],
  },
  // 🎨 媒体生成 → 多向下游
  reroute: { label: '中继节点' },
  mediaGen: {
    reroute: ['input'], imageGen: ['prompt','image'], videoGen: ['prompt','image'],
    preview: ['input'], videoGen: ['image'], agent: ['prompt'],
    textPrompt: ['prompt'],    // 生成结果→提示词迭代
    mediaGen: ['prompt', 'image'],  // 链式生成(图→视频等)
  },
}

// ===== 图片生成模型 (keyReuse = 复用已有聊天 Key) =====
export const IMAGE_MODELS = [
  { id: 'gpt-image-1', name: 'GPT-4o 图像 (OpenAI)', sizes: ['1024x1024', '1792x1024', '1024x1792'], keyReuse: 'openai' },
  { id: 'dall-e-3', name: 'DALL·E 3 (OpenAI)', sizes: ['1024x1024', '1792x1024', '1024x1792'], keyReuse: 'openai' },
  { id: 'seedream', name: 'Seedream 5.0 (字节)', sizes: ['1024x1024', '2048x2048'], keyReuse: 'seedance' },
  { id: 'qwen-image', name: '通义万相 (阿里)', sizes: ['1024x1024', '1280x720'], keyReuse: 'qwen' },
  { id: 'cogview', name: 'CogView (智谱)', sizes: ['1024x1024'], keyReuse: 'glm' },
  { id: 'minimax-image', name: 'MiniMax 图像 (海螺)', sizes: ['1024x1024', '2048x2048'], keyReuse: 'minimax' },
  { id: 'gemini', name: 'Gemini 3 Flash 图像 (Google)', sizes: ['1024x1024', '2048x2048'], keyReuse: 'gemini' },
  { id: 'flux', name: 'Flux.1 Pro (Black Forest)', sizes: ['1024x1024', '1280x720', '720x1280'], keyReuse: 'openai' },
  { id: 'stability', name: 'Stable Diffusion 3.5', sizes: ['1024x1024', '1344x768', '768x1344'], keyReuse: null },
  { id: 'midjourney', name: 'Midjourney V7', sizes: ['1024x1024', '2048x2048'], keyReuse: null },
  { id: 'imagen', name: 'Imagen 3 (Google)', sizes: ['1024x1024', '1536x1536', '2048x2048'], keyReuse: 'gemini' },
  { id: 'banana', name: 'Nano Banana (TapNow)', sizes: ['1024x1024', '1280x720'], keyReuse: null },
  { id: 'agnes-image', name: 'Agnes Image 2.1 (免费)', sizes: ['1024x1024', '1792x1024', '1024x1792'], keyReuse: 'agnes' },
]

// ===== 视频生成模型 =====
export const VIDEO_MODELS = [
  { id: 'sora', name: 'Sora 2 (OpenAI)', durationRange: [5, 15], keyReuse: 'openai' },
  { id: 'seedance', name: 'Seedance 2.0 (字节)', durationRange: [3, 15], keyReuse: 'seedance' },
  { id: 'kling', name: '可灵 3.0 (快手)', durationRange: [3, 15], keyReuse: 'kling' },
  { id: 'wan', name: 'Wan 2.6 (阿里)', durationRange: [3, 10], keyReuse: 'qwen' },
  { id: 'minimax-video', name: '海螺视频 (MiniMax)', durationRange: [3, 15], keyReuse: 'minimax' },
  { id: 'gemini-video', name: 'Gemini 3 视频 (Google)', durationRange: [3, 10], keyReuse: 'gemini' },
  { id: 'runway', name: 'Runway Gen-4', durationRange: [4, 10], keyReuse: null },
  { id: 'pika', name: 'Pika 2.0', durationRange: [3, 10], keyReuse: null },
  { id: 'veo', name: 'Veo 3 (Google)', durationRange: [5, 15], keyReuse: 'gemini' },
  { id: 'agnes-video', name: 'Agnes Video V2.0 (免费·音画同出)', durationRange: [3, 15], keyReuse: 'agnes' },
]

// ===== 8 个 AI 智能体 (来自侧边栏) =====
export const AGENT_MODES = [
  { id: 'director', name: '🎬 导演', desc: '分镜 · 剧本 · 预算通告' },
  { id: 'doctor', name: '📋 剧本医生', desc: '四层诊断 · 逐句修改' },
  { id: 'designer', name: '🎨 美术指导', desc: '视觉概念 · 色彩体系' },
  { id: 'post', name: '🎛️ 后期总监', desc: '剪辑 · 调色 · 声音' },
  { id: 'seedance', name: '📖 剧幕文戏分析', desc: '逐幕情绪动作拆解' },
  { id: 'character', name: '👤 人物造型', desc: '七层框架 · 高精度角色' },
  { id: 'scene', name: '🏛️ 场景设计', desc: '十维场景生成' },
  { id: 'lens', name: '🔍 视觉解析师', desc: '反向提示词 · 视觉DNA' },
  { id: 'cinematographer', name: '📷 摄影指导', desc: '镜头语法 · 布光方案 · 运镜动机' },
  { id: 'sound', name: '🔊 声音设计', desc: '音景 · 拟音 · 配乐情绪曲线' },
  { id: 'colorist', name: '🎨 调色师', desc: '色彩管线 · LUT · 场景过渡' },
  { id: 'prompteng', name: '🤖 提示词工程师', desc: 'AI Agent 提示词生成' },
]


// ===== libtv-level visual style exports =====
export const getNodeColor = (type) => NODE_COLORS[type] || NODE_COLORS.agent
export const getNodeBorderColor = (type) => NODE_COLORS[type]?.border || '#555'
export const getNodeGlow = (type) => NODE_COLORS[type]?.glow || 'transparent'
export const getNodeIconColor = (type) => NODE_COLORS[type]?.icon || '#fff'
export const getStatusColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.idle

// Connection validation with error message (libtv-level feedback)
export function getConnectionError(sourceType, targetType) {
  const valid = validConnections[sourceType]
  if (!valid) return `Unknown source type: ${sourceType}`
  if (!valid[targetType]) {
    const allowed = Object.keys(valid).map(t => t).join(', ')
    return `${sourceType} cannot connect to ${targetType}. Allowed targets: ${allowed}`
  }
  return null // Valid connection
}
