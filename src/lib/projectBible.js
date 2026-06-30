/**
 * Project Bible — 项目圣经
 *
 * Persistent project-level state that all agents reference.
 * Analogous to a film's Production Bible / Look Book.
 *
 * Stored in localStorage under 'director_studio_bible'.
 */

const STORAGE_KEY = 'director_studio_bible'

const DEFAULT_BIBLE = {
  projectName: '',
  referenceFilms: [],       // [{ title, director, year, notes }]
  defaultAspectRatio: '16:9',
  targetPlatforms: [],      // ['seedance', 'kling', 'runway', ...]
  targetModel: '',          // preferred AI video model
  characterLibrary: [],     // [{ name, description, visualAnchors, agentOutput }]
  sceneLibrary: [],         // [{ name, description, location, timeOfDay, agentOutput }]
  colorScript: '',          // global color strategy
  visualStyle: '',          // overall visual style anchor
  createdAt: null,
  updatedAt: null,
}

// --- Reactive external store (not Zustand — plain module pattern) ---
let _state = null
const _listeners = new Set()

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      _state = { ...DEFAULT_BIBLE, ...parsed }
    } else {
      _state = { ...DEFAULT_BIBLE }
    }
  } catch {
    _state = { ...DEFAULT_BIBLE }
  }
  return _state
}

function _save(state) {
  _state = { ...state, updatedAt: Date.now() }
  if (!_state.createdAt) _state.createdAt = Date.now()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state))
  } catch (e) {
    // localStorage quota exceeded — silently fail
  }
  _listeners.forEach(fn => { try { fn(_state) } catch {} })
}

function getBible() {
  return _state || _load()
}

function updateBible(patch) {
  const current = getBible()
  _save({ ...current, ...patch })
}

function subscribe(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

// Character management
function addCharacter(character) {
  const current = getBible()
  const existing = current.characterLibrary.findIndex(c => c.name === character.name)
  const lib = [...current.characterLibrary]
  if (existing >= 0) {
    lib[existing] = { ...lib[existing], ...character, updatedAt: Date.now() }
  } else {
    lib.push({ ...character, createdAt: Date.now(), updatedAt: Date.now() })
  }
  updateBible({ characterLibrary: lib })
}

function removeCharacter(name) {
  const current = getBible()
  updateBible({ characterLibrary: current.characterLibrary.filter(c => c.name !== name) })
}

// Scene management
function addScene(scene) {
  const current = getBible()
  const existing = current.sceneLibrary.findIndex(s => s.name === scene.name)
  const lib = [...current.sceneLibrary]
  if (existing >= 0) {
    lib[existing] = { ...lib[existing], ...scene, updatedAt: Date.now() }
  } else {
    lib.push({ ...scene, createdAt: Date.now(), updatedAt: Date.now() })
  }
  updateBible({ sceneLibrary: lib })
}

// Context injection — builds a prefix for agent system prompts
function buildBibleContext() {
  const bible = getBible()
  const parts = []

  if (bible.projectName) {
    parts.push(`## 项目圣经\n当前项目：${bible.projectName}`)
  } else {
    parts.push('## 项目圣经')
  }

  if (bible.visualStyle) {
    parts.push(`整体视觉风格：${bible.visualStyle}`)
  }
  if (bible.referenceFilms.length > 0) {
    const refs = bible.referenceFilms
      .map(r => `${r.title}(${r.director}·${r.year})${r.notes ? ` — ${r.notes}` : ''}`)
      .join('、')
    parts.push(`风格参考影片：${refs}`)
  }
  if (bible.colorScript) {
    parts.push(`色彩脚本：${bible.colorScript}`)
  }
  if (bible.defaultAspectRatio) {
    parts.push(`默认画幅比：${bible.defaultAspectRatio}`)
  }
  if (bible.targetPlatforms.length > 0) {
    parts.push(`目标平台：${bible.targetPlatforms.join('、')}`)
  }

  // Character library
  if (bible.characterLibrary.length > 0) {
    parts.push('\n### 角色库')
    bible.characterLibrary.forEach(c => {
      parts.push(`- ${c.name}：${c.description || ''}${c.visualAnchors ? ` | 视觉锚点: ${c.visualAnchors}` : ''}`)
    })
  }

  // Scene library
  if (bible.sceneLibrary.length > 0) {
    parts.push('\n### 场景库')
    bible.sceneLibrary.forEach(s => {
      parts.push(`- ${s.name}：${s.description || ''} | ${s.location || ''} | ${s.timeOfDay || ''}`)
    })
  }

  parts.push('\n---\n请在设计时优先参考以上项目信息，确保风格一致性。')

  return parts.join('\n')
}

export {
  getBible, updateBible, subscribe,
  addCharacter, removeCharacter, addScene,
  buildBibleContext,
  DEFAULT_BIBLE,
}
