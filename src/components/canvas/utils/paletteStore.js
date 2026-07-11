// Canvas Palette Store — favorites and recently used
// Isolated from nodeDefaults to avoid module init ordering issues

const FAV_STORAGE_KEY = 'canvas_palette_favorites'
const RECENT_STORAGE_KEY = 'canvas_palette_recents'

export function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_STORAGE_KEY) || '[]') } catch { return [] }
}

export function toggleFavorite(type) {
  const favs = getFavorites()
  const idx = favs.indexOf(type)
  if (idx >= 0) favs.splice(idx, 1)
  else favs.push(type)
  localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favs))
  return favs
}

export function getRecents() {
  try { return JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || '[]') } catch { return [] }
}

export function addRecent(type) {
  const recents = getRecents().filter(t => t !== type)
  recents.unshift(type)
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recents.slice(0, 8)))
  return recents
}
