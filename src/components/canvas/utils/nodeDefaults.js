export const nodeDefaults = {
  textPrompt: {
    label: '文本提示词', prompt: '',
  },
  imageGen: {
    label: '图片生成', prompt: '', negativePrompt: '',
    modelProvider: 'openai', aspectRatio: '1:1', imageCount: 1,
    generatedImages: [], status: 'idle', errorMessage: '',
  },
  videoGen: {
    label: '视频生成', prompt: '', sourceImage: null,
    modelProvider: 'seedance', duration: 5,
    progress: 0, generatedVideo: null, status: 'idle', errorMessage: '',
  },
  reference: {
    label: '参考素材', mediaType: 'image', mediaData: null, fileName: '',
  },
  preview: {
    label: '预览输出', outputType: 'image', outputContent: null,
    status: 'idle', errorMessage: '',
  },
  agent: {
    label: 'AI 智能体', agentMode: 'director', prompt: '',
    response: '', status: 'idle', errorMessage: '',
  },
}

// Valid connections
export const validConnections = {
  textPrompt: { imageGen: ['prompt'], videoGen: ['prompt'], agent: ['prompt'] },
  imageGen: { preview: ['input'], videoGen: ['image'], agent: ['prompt'] },
  videoGen: { preview: ['input'] },
  reference: { imageGen: ['prompt'], videoGen: ['image'] },
  preview: {},
  agent: { preview: ['input'] },
}

// ===== 图片生成模型 =====
export const IMAGE_MODELS = [
  { id: 'openai', name: 'DALL·E 3 (OpenAI)', sizes: ['1024x1024', '1792x1024', '1024x1792'] },
  { id: 'stability', name: 'Stable Diffusion 3.5', sizes: ['1024x1024', '1344x768', '768x1344'] },
  { id: 'seedream', name: 'Seedream 5.0 (字节)', sizes: ['1024x1024', '2048x2048'] },
  { id: 'midjourney', name: 'Midjourney V7', sizes: ['1024x1024', '2048x2048'] },
  { id: 'flux', name: 'Flux.1 Pro (Black Forest)', sizes: ['1024x1024', '1280x720', '720x1280'] },
  { id: 'imagen', name: 'Imagen 3 (Google)', sizes: ['1024x1024', '1536x1536', '2048x2048'] },
  { id: 'banana', name: 'Nano Banana (TapNow 角色一致性)', sizes: ['1024x1024', '1280x720'] },
  { id: 'gemini', name: 'Gemini 3 Flash 图像 (Google)', sizes: ['1024x1024', '2048x2048'] },
  { id: 'qwen', name: '通义万相 (阿里)', sizes: ['1024x1024', '1280x720'] },
  { id: 'glm', name: 'CogView (智谱)', sizes: ['1024x1024'] },
  { id: 'minimax', name: 'MiniMax 图像 (海螺)', sizes: ['1024x1024', '2048x2048'] },
]

// ===== 视频生成模型 (durationRange: [min秒, max秒]) =====
export const VIDEO_MODELS = [
  { id: 'seedance', name: 'Seedance 2.0 (字节)', durationRange: [3, 15] },
  { id: 'kling', name: '可灵 3.0 (快手)', durationRange: [3, 15] },
  { id: 'wan', name: 'Wan 2.6 (阿里)', durationRange: [3, 10] },
  { id: 'runway', name: 'Runway Gen-4', durationRange: [4, 10] },
  { id: 'pika', name: 'Pika 2.0', durationRange: [3, 10] },
  { id: 'hailuo', name: '海螺视频 (MiniMax)', durationRange: [3, 15] },
  { id: 'veo', name: 'Veo 3 (Google)', durationRange: [5, 15] },
  { id: 'sora', name: 'Sora 2 (OpenAI)', durationRange: [5, 15] },
  { id: 'gemini-video', name: 'Gemini 3 视频 (Google)', durationRange: [3, 10] },
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
]
