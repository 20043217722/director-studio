// Workflow templates — one-click pipeline setup
export const WORKFLOW_TEMPLATES = [
  {
    id: 'story-to-video',
    name: '故事 → 视频',
    icon: '🎬',
    desc: '从故事创意到完整视频输出的标准管线',
    nodes: [
      { type: 'agent', label: '导演', position: { x: 100, y: 100 }, agentMode: 'director' },
      { type: 'agent', label: '摄影指导', position: { x: 500, y: 50 }, agentMode: 'cinematographer' },
      { type: 'agent', label: '剧幕文戏', position: { x: 500, y: 250 }, agentMode: 'seedance' },
      { type: 'videoGen', label: '视频生成', position: { x: 900, y: 150 } },
    ],
    edges: [
      { source: 0, target: 1 }, { source: 0, target: 2 },
      { source: 1, target: 3 }, { source: 2, target: 3 },
    ],
  },
  {
    id: 'char-scene-design',
    name: '人物 + 场景设计',
    icon: '👤🏛️',
    desc: '剧本角色提取 → 人物造型 + 场景设计',
    nodes: [
      { type: 'agent', label: '剧本医生', position: { x: 100, y: 100 }, agentMode: 'doctor' },
      { type: 'agent', label: '人物造型', position: { x: 500, y: 50 }, agentMode: 'character' },
      { type: 'agent', label: '场景设计', position: { x: 500, y: 250 }, agentMode: 'scene' },
      { type: 'imageGen', label: '角色生图', position: { x: 900, y: 50 } },
      { type: 'imageGen', label: '场景生图', position: { x: 900, y: 250 } },
    ],
    edges: [
      { source: 0, target: 1 }, { source: 0, target: 2 },
      { source: 1, target: 3 }, { source: 2, target: 4 },
    ],
  },
  {
    id: 'image-reverse',
    name: '图片反推 + 生图',
    icon: '🔍🎨',
    desc: '参考图 → 视觉解析 → 反向生成新图',
    nodes: [
      { type: 'reference', label: '参考图', position: { x: 100, y: 100 } },
      { type: 'agent', label: '视觉解析师', position: { x: 500, y: 100 }, agentMode: 'lens' },
      { type: 'imageGen', label: '反向生图', position: { x: 900, y: 100 } },
    ],
    edges: [
      { source: 0, target: 1 }, { source: 1, target: 2 },
    ],
  },
  {
    id: 'script-doctor',
    name: '剧本诊断 + 修复',
    icon: '📝💊',
    desc: '剧本 → 诊断 → 修复提示词 → 再生成',
    nodes: [
      { type: 'agent', label: '导演(初稿)', position: { x: 100, y: 100 }, agentMode: 'director' },
      { type: 'agent', label: '剧本医生', position: { x: 500, y: 100 }, agentMode: 'doctor' },
      { type: 'agent', label: '导演(修复版)', position: { x: 900, y: 100 }, agentMode: 'director' },
    ],
    edges: [
      { source: 0, target: 1 }, { source: 1, target: 2 },
    ],
  },
  {
    id: 'ad-creation',
    name: 'TVC 广告创作',
    icon: '📺',
    desc: '品牌策划 → 广告剧本 → 分镜 → 视频',
    nodes: [
      { type: 'agent', label: '广告导演', position: { x: 100, y: 100 }, agentMode: 'director' },
      { type: 'agent', label: '人物造型', position: { x: 500, y: 50 }, agentMode: 'character' },
      { type: 'agent', label: '场景设计', position: { x: 500, y: 200 }, agentMode: 'scene' },
      { type: 'agent', label: '剧幕文戏', position: { x: 900, y: 50 }, agentMode: 'seedance' },
      { type: 'videoGen', label: '广告成片', position: { x: 1300, y: 125 } },
    ],
    edges: [
      { source: 0, target: 1 }, { source: 0, target: 2 },
      { source: 1, target: 4 }, { source: 2, target: 4 }, { source: 3, target: 4 },
    ],
  },
  {
    id: 'style-transfer',
    name: '风格迁移管线',
    icon: '🎨➡️',
    desc: '参考风格 → 美术指导 → 场景 + 角色统一生成',
    nodes: [
      { type: 'reference', label: '风格参考', position: { x: 100, y: 100 } },
      { type: 'agent', label: '视觉解析师', position: { x: 400, y: 100 }, agentMode: 'lens' },
      { type: 'agent', label: '美术指导', position: { x: 700, y: 100 }, agentMode: 'designer' },
      { type: 'agent', label: '场景设计', position: { x: 1000, y: 50 }, agentMode: 'scene' },
      { type: 'agent', label: '人物造型', position: { x: 1000, y: 200 }, agentMode: 'character' },
    ],
    edges: [
      { source: 0, target: 1 }, { source: 1, target: 2 },
      { source: 2, target: 3 }, { source: 2, target: 4 },
    ],
  },
]
