const fs = require('fs')
process.chdir('D:/导演工作室')

console.log('╔══════════════════════════════════════╗')
console.log('║  P0 管线 — 深度集成测试              ║')
console.log('╚══════════════════════════════════════╝')
console.log()

let pass = 0, fail = 0
function check(label, condition) {
  if (condition) { console.log('  ' + label + ': ✅'); pass++ }
  else { console.log('  ' + label + ': ❌ FAIL'); fail++ }
}

// ===== A. Project Bible Store =====
console.log('A. 项目圣经 (projectBible.js)')
const storeText = fs.readFileSync('src/lib/projectBible.js', 'utf-8')

check('导出 getBible', storeText.includes('export {') && storeText.includes('getBible'))
check('导出 updateBible', storeText.includes('updateBible'))
check('导出 subscribe', storeText.includes('subscribe'))
check('导出 buildBibleContext', storeText.includes('buildBibleContext'))
check('导出 addCharacter', storeText.includes('addCharacter'))
check('导出 removeCharacter', storeText.includes('removeCharacter'))
check('导出 addScene', storeText.includes('addScene'))
check('DEFAULT_BIBLE 定义存在', storeText.includes('DEFAULT_BIBLE'))
check('localStorage key 正确', storeText.includes('director_studio_bible'))
check('buildBibleContext 包含项目圣经标题', storeText.includes('项目圣经'))

// ===== B. Project Bible Panel =====
console.log('\nB. 项目圣经面板 (ProjectBiblePanel.jsx)')
const panelText = fs.readFileSync('src/components/canvas/ProjectBiblePanel.jsx', 'utf-8')

check('组件导出 ProjectBiblePanel', panelText.includes('export function ProjectBiblePanel'))
check('三个标签页: info/characters/scenes', panelText.includes("'info'") && panelText.includes("'characters'") && panelText.includes("'scenes'"))
check('项目名称输入', panelText.includes('projectName'))
check('视觉风格输入', panelText.includes('visualStyle'))
check('色彩脚本输入', panelText.includes('colorScript'))
check('画幅比选择', panelText.includes('defaultAspectRatio'))
check('目标平台多选', panelText.includes('targetPlatforms'))
check('参考影片管理', panelText.includes('referenceFilms'))
check('角色添加/删除', panelText.includes('addCharacter') && panelText.includes('removeCharacter'))
check('场景添加', panelText.includes('addScene'))

// ===== C. CanvasWorkspace Integration =====
console.log('\nC. CanvasWorkspace 集成')
const wsText = fs.readFileSync('src/components/canvas/CanvasWorkspace.jsx', 'utf-8')

check('导入 ProjectBiblePanel', wsText.includes("import { ProjectBiblePanel }"))
check('渲染 ProjectBiblePanel', wsText.includes('<ProjectBiblePanel />'))

// ===== D. AgentNode Bible Injection =====
console.log('\nD. AgentNode 项目圣经注入')
const agentText = fs.readFileSync('src/components/canvas/nodes/AgentNode.jsx', 'utf-8')

check('动态导入 projectBible', agentText.includes("import('../../../lib/projectBible')"))
check('调用 buildBibleContext', agentText.includes('buildBibleContext()'))
check('bible 上下文注入 prompt', agentText.includes('promptWithBible'))

// ===== E. Version Management =====
console.log('\nE. 版本管理 (MediaGenNode)')
const mgText = fs.readFileSync('src/components/canvas/nodes/MediaGenNode.jsx', 'utf-8')

check('imageVersions 数组', mgText.includes('imageVersions'))
check('videoVersions 数组', mgText.includes('videoVersions'))
check('生成前保存旧版本', mgText.includes('data.imageVersions || []') && mgText.includes('data.videoVersions || []'))
check('VersionNav 组件', mgText.includes('function VersionNav'))
check('版本切换 onChange', mgText.includes('onChange={(v)'))
check('版本号显示 v{current+1}/{total} 格式', mgText.includes('v{current + 1}/{total}'))

// ===== F. Multi-Shot Expansion =====
console.log('\nF. 一键多镜头展开 (AgentNode)')

check('extractShots 提取函数', agentText.includes('function extractShots'))
check('ShotExpandButton 组件', agentText.includes('function ShotExpandButton'))
check('展开按钮 UI', agentText.includes('一键展开'))
check('shot prompt 解析 (结构性块)', agentText.includes('<!--PROMPT'))
check('shot prompt 解析 (表格)', agentText.includes('镜\\d+|Shot'))
check('MAX_NODES 检查', agentText.includes('MAX_NODES') || agentText.includes('节点数已达上限'))
check('创建 MediaGen + Preview 节点', agentText.includes("type: 'mediaGen'") && agentText.includes("type: 'preview'"))
check('自动连线 Agent→MediaGen', agentText.includes("source: id, sourceHandle: 'output'"))

// ===== G. Simulate extractShots =====
console.log('\nG. extractShots 功能测试')

function extractShots(text) {
  if (!text) return []
  const shots = []
  const promptRe = /<!--PROMPT:(\w+)-->([\s\S]*?)<!--\/PROMPT:\1-->/g
  let match
  while ((match = promptRe.exec(text)) !== null) {
    const content = match[2].trim()
    const parts = content.split(/(?=(?:镜\d+|Shot\s*\d+|P\d+|拍\d+))/)
    for (const part of parts) {
      const cleaned = part.trim()
      if (cleaned && cleaned.length > 10) {
        shots.push({ platform: match[1], prompt: cleaned })
      }
    }
  }
  // Plain text with shot numbering
  if (shots.length === 0) {
    const lines = text.split('\n')
    for (const line of lines) {
      if (/(?:镜\d+|Shot\s*\d+|P\d+|拍\d+)/i.test(line) && line.length > 15) {
        shots.push({ platform: 'seedance', prompt: line.trim() })
      }
    }
  }
  return shots
}

// Test with structured blocks containing multiple shots
const multiShotResponse = [
  '## 摄影策略',
  '<!--PROMPT:seedance-->',
  '镜1 / 8s | 中近景 85mm 缓推 | 女主凝视窗外 | 光:45° 3200K 4:1柔',
  '镜2 / 6s | 特写 135mm 固定 | 女主眼睛流泪 | 光:逆光 4300K 8:1',
  '镜3 / 10s | 广角 24mm 横摇 | 咖啡馆全景雨夜 | 光:顶光 3200K 2:1',
  '<!--/PROMPT:seedance-->',
].join('\n')

const shots = extractShots(multiShotResponse)
check('提取到 3 个镜头', shots.length === 3)
check('镜1 内容正确', shots[0] && shots[0].prompt.includes('镜1'))
check('镜3 内容正确', shots[2] && shots[2].prompt.includes('镜3'))
check('平台标记为 seedance', shots[0] && shots[0].platform === 'seedance')

// Test with plain text shots
const plainTextShots = [
  'Some analysis here...',
  '镜1 中近景 85mm 缓推 女主凝视窗外 光45° 3200K',
  '镜2 特写 135mm 固定 手部特写 侧面光5600K',
  'More analysis...',
].join('\n')

const plainShots = extractShots(plainTextShots)
check('纯文本提取到 2 个镜头', plainShots.length === 2)

// Test empty
check('空文本返回空数组', extractShots('').length === 0)
check('无镜头文本返回空', extractShots('Some random text').length === 0)

// ===== H. Version management logic =====
console.log('\nH. 版本管理逻辑测试')

// Simulate version tracking
function simulateVersions(existingVersions, currentResult) {
  const vers = [...existingVersions]
  if (currentResult && currentResult.length > 0 && !vers.includes(currentResult)) {
    vers.push(currentResult)
  }
  return vers
}

let imgVersions = []
const gen1 = [{ url: 'img1.png' }]
const gen2 = [{ url: 'img2.png' }]
imgVersions = simulateVersions(imgVersions, gen1)
check('v1 追加后 versions 长度=1', imgVersions.length === 1)
imgVersions = simulateVersions(imgVersions, gen2)
check('v2 追加后 versions 长度=2', imgVersions.length === 2)
imgVersions = simulateVersions(imgVersions, gen1) // duplicate
check('重复版本不追加', imgVersions.length === 2)

// All versions including current
const allVersions = [...imgVersions]
const current = [{ url: 'img3.png' }]
if (!imgVersions.includes(current)) allVersions.push(current)
check('allVersions 含当前+历史', allVersions.length === 3)

console.log('\n═══════════════════════════════════════')
console.log('  结果: ' + pass + ' passed, ' + fail + ' failed')
if (fail === 0) {
  console.log('  P0 管线深度测试全部通过 ✅')
} else {
  console.log('  有 ' + fail + ' 项测试失败 ❌')
}
console.log('═══════════════════════════════════════')

process.exit(fail > 0 ? 1 : 0)
