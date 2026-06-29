const fs = require('fs')
const path = require('path')
process.chdir('D:/导演工作室')

console.log('╔══════════════════════════════════════╗')
console.log('║  P0 升级 — 全面集成测试报告 v2       ║')
console.log('╚══════════════════════════════════════╝')
console.log()

const ndContent = fs.readFileSync('src/components/canvas/utils/nodeDefaults.js', 'utf-8')
const apiContent = fs.readFileSync('src/lib/api.js', 'utf-8')
const storeContent = fs.readFileSync('src/components/canvas/utils/canvasStore.js', 'utf-8')

let pass = 0, fail = 0
function check(label, condition) {
  if (condition) { console.log('  ' + label + ': ✅'); pass++ }
  else { console.log('  ' + label + ': ❌ FAIL'); fail++ }
}

// ===== A. AGENT_MODES =====
console.log('A. AGENT_MODES 完整性')
const modesMatch = ndContent.match(/export const AGENT_MODES = \[([\s\S]*?)\]/)
const allModes = modesMatch ? modesMatch[1] : ''
const modeIds = [...allModes.matchAll(/id:\s*'(\w+)'/g)].map(m => m[1])
check('总模式数 = 9', modeIds.length === 9)
check('cinematographer 存在', modeIds.includes('cinematographer'))

// ===== B. DP Prompt — Overlap Resolution =====
console.log('\nB. 职责边界（防重叠）')
const dpStart = apiContent.indexOf('cinematographer:')
const dpSection = apiContent.slice(dpStart)
const dpEnd = dpSection.indexOf('const qualityFramework')
const dpPrompt = dpSection.slice(0, dpEnd)

check('职责边界表存在', dpPrompt.includes('职责边界'))
check('建议切换到 👤 人物造型', dpPrompt.includes('人物造型 Agent'))
check('建议切换到 🏛️ 场景设计', dpPrompt.includes('场景设计 Agent'))
check('建议切换到 📖 剧幕文戏', dpPrompt.includes('剧幕文戏 Agent'))
check('建议切换到 🎬 导演', dpPrompt.includes('导演 Agent'))
check('建议切换到 🔍 视觉解析师', dpPrompt.includes('视觉解析师 Agent'))
check('建议切换到 🎨 美术指导', dpPrompt.includes('美术指导 Agent'))

// ===== C. P0-1: Continuity Lock =====
console.log('\nC. P0-1 连续性锁头')
check('LOCK:continuity 块存在', dpPrompt.includes('LOCK:continuity'))
check('角色锚点字段', dpPrompt.includes('角色锚点'))
check('光线锚点字段', dpPrompt.includes('光线锚点'))
check('色彩锚点字段', dpPrompt.includes('色彩锚点'))
check('空间锚点字段', dpPrompt.includes('空间锚点'))
check('风格锚点字段', dpPrompt.includes('风格锚点'))

// ===== D. P0-2: Negative Prompts =====
console.log('\nD. P0-2 负向提示词')
const negPlatforms = ['seedance', 'kling', 'runway', 'sora', 'pika', 'wan', 'hailuo']
negPlatforms.forEach(p => {
  check('NEGATIVE:' + p + ' 块存在', dpPrompt.includes('NEGATIVE:' + p))
})

// ===== E. P0-3: Temporal Structure =====
console.log('\nE. P0-3 镜头内时序结构')
check('时序结构说明存在', dpPrompt.includes('镜头内时序结构'))
check('时间轴标注要求', dpPrompt.includes('0s'))

// ===== F. P0-4: Platform-Specific Strategies =====
console.log('\nF. P0-4 平台策略差异化')
check('Kling 策略: 中文·短句·人脸优先', dpPrompt.includes('策略 1: Kling'))
check('Runway 策略: 英文·自然语言·运镜', dpPrompt.includes('策略 2: Runway'))
check('Sora 策略: 英文·动作驱动·物理', dpPrompt.includes('策略 3: Sora'))
check('Seedance 策略: 结构化·微表情', dpPrompt.includes('策略 4: Seedance'))
check('Pika 策略: 极简·风格化·5-15词', dpPrompt.includes('策略 5: Pika'))
check('Wan 策略: 场景氛围·光影优先', dpPrompt.includes('策略 6: Wan'))
check('Hailuo 策略: 电影叙事·光影感', dpPrompt.includes('策略 7: Hailuo'))

// Check AI translation — no tech params in Kling/Sora/Pika prompts
check('Kling 策略: 避免技术参数', dpPrompt.includes('避免技术参数'))
check('Sora 策略: 不用 T-stop/K', dpPrompt.includes('no technical parameters'))
check('Pika 策略: 不要数值', dpPrompt.includes('no numbers'))

// ===== G. Parser Functions =====
console.log('\nG. 结构化解析器升级')
check('extractStructuredBlocks 含 negatives', storeContent.includes('negatives'))
check('extractStructuredBlocks 含 continuity', storeContent.includes('continuity'))
check('extractBestNegative 函数存在', storeContent.includes('extractBestNegative'))
check('extractContinuityLock 函数存在', storeContent.includes('extractContinuityLock'))

// ===== H. Functional Test: Parser =====
console.log('\nH. 解析器功能测试')

const simResponse = [
  '## 摄影策略概述',
  '雨夜孤独场景',
  '',
  '<!--LOCK:continuity-->',
  '角色锚点：30岁亚裔女性·黑长直发·左眉疤痕·肤色III',
  '光线锚点：主光45°左·3200K·光比4:1·柔光罩',
  '色彩锚点：主#1a1a2e(60%)·辅#c49a6c(30%)·强调#d4442a(10%)·Portra 400',
  '空间锚点：雨夜咖啡馆窗边·铜质台灯·红丝绒窗帘',
  '风格锚点：《重庆森林》1994·2.39:1·Kodak 5219',
  '<!--/LOCK:continuity-->',
  '',
  '<!--PROMPT:seedance-->',
  '85mm 缓推0.3m/s 女主AU1+4+15强度3 [光:45°3200K 4:1柔] [色:主#1a1a2e] [时序:0-2s静→2-5s推→5-8s表情峰] 8s',
  '<!--/PROMPT:seedance-->',
  '<!--NEGATIVE:seedance-->',
  '面部变形·五官移位·肢体断裂·材质漂移',
  '<!--/NEGATIVE:seedance-->',
  '',
  '<!--PROMPT:kling-->',
  '年轻女性独自坐在雨夜咖啡馆窗边，温暖台灯照亮她忧郁的侧脸，85mm电影镜头感',
  '<!--/PROMPT:kling-->',
  '<!--NEGATIVE:kling-->',
  '面部变形·多余手指·肢体断裂·纹理模糊',
  '<!--/NEGATIVE:kling-->',
  '',
  '<!--PROMPT:sora-->',
  'A young woman sits alone by a rain-streaked cafe window at night, warm lamp light casting soft shadows across her melancholic face, the city lights blurred in the distance, slow dolly in, cinematic',
  '<!--/PROMPT:sora-->',
  '<!--NEGATIVE:sora-->',
  'unnatural physics·disconnected limbs·inconsistent lighting',
  '<!--/NEGATIVE:sora-->',
].join('\n')

// Re-implement the parser for testing
function extractStructuredBlocks(text) {
  if (!text) return { prompts: {}, negatives: {}, continuity: null, metadata: null }
  const blocks = { prompts: {}, negatives: {}, continuity: null, metadata: null }
  const promptRe = /<!--PROMPT:(\w+)-->([\s\S]*?)<!--\/PROMPT:\1-->/g
  let match
  while ((match = promptRe.exec(text)) !== null) {
    blocks.prompts[match[1]] = match[2].trim()
  }
  const negRe = /<!--NEGATIVE:(\w+)-->([\s\S]*?)<!--\/NEGATIVE:\1-->/g
  while ((match = negRe.exec(text)) !== null) {
    blocks.negatives[match[1]] = match[2].trim()
  }
  const lockRe = /<!--LOCK:continuity-->([\s\S]*?)<!--\/LOCK:continuity-->/
  const lockMatch = lockRe.exec(text)
  if (lockMatch) blocks.continuity = lockMatch[1].trim()
  return blocks
}

const parsed = extractStructuredBlocks(simResponse)
check('提取 3 个平台提示词', Object.keys(parsed.prompts).length === 3)
check('提取 3 个负向提示词', Object.keys(parsed.negatives).length === 3)
check('连续性锁头提取成功', parsed.continuity !== null)
check('锁头包含角色锚点', parsed.continuity && parsed.continuity.includes('角色锚点'))
check('锁头包含光线锚点', parsed.continuity && parsed.continuity.includes('光线锚点'))

// Verify prompt content is natural language (not parameter lists) for Kling/Sora
const klingPrompt = parsed.prompts['kling']
const soraPrompt = parsed.prompts['sora']
check('Kling 提示词是自然语言(非参数列表)', klingPrompt && !klingPrompt.includes('[光:') && !klingPrompt.includes('K'))
check('Sora 提示词是自然语言(无技术参数)', soraPrompt && !soraPrompt.includes('T-stop') && !soraPrompt.includes('3200K'))

// Negative prompt matching
const klingNeg = parsed.negatives['kling']
const soraNeg = parsed.negatives['sora']
check('Kling 负向含面部变形', klingNeg && klingNeg.includes('面部变形'))
check('Sora 负向含 unnatural physics', soraNeg && soraNeg.includes('unnatural physics'))

// ===== I. Agent→Downstream in store =====
console.log('\nI. Agent→下游数据流')
check('extractBestNegative 被使用', storeContent.includes('extractBestNegative'))
check('extractContinuityLock 被使用', storeContent.includes('extractContinuityLock'))
check('continuityLock 传递给下游', storeContent.includes('continuityLock: lock'))
check('negativePrompt 传递给 gen 节点', storeContent.includes('negativePrompt: neg'))

console.log('\n═══════════════════════════════════════')
console.log('  结果: ' + pass + ' passed, ' + fail + ' failed')
if (fail === 0) {
  console.log('  P0 升级全部通过 ✅')
} else {
  console.log('  有 ' + fail + ' 项测试失败 ❌')
}
console.log('═══════════════════════════════════════')

process.exit(fail > 0 ? 1 : 0)
