/**
 * Director Studio — Simple Analytics
 * Tracks: page views, unique visitors, active sessions
 * Uses: countapi.xyz (free) + localStorage for session tracking
 */

const COUNTER_API = 'https://api.countapi.xyz'
const NAMESPACE = 'director-studio'
const SITE_KEY = 'director-studio-gh-pages'

// Generate a persistent anonymous visitor ID
function getVisitorId() {
  let id = localStorage.getItem('ds_visitor_id')
  if (!id) {
    id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
    localStorage.setItem('ds_visitor_id', id)
  }
  return id
}

// Session tracking
let sessionStart = null
function getSessionId() {
  if (!sessionStart) {
    sessionStart = Date.now()
    sessionStorage.setItem('ds_session_start', sessionStart.toString())
  }
  return getVisitorId() + '_' + sessionStart
}

// ===== Public API =====

/** Record a page view */
export async function trackPageView() {
  try {
    // Total page views (lifetime)
    const viewsRes = await fetch(`${COUNTER_API}/hit/${NAMESPACE}/${SITE_KEY}/views`)
    const viewsData = await viewsRes.json()

    // Today's views
    const today = new Date().toISOString().slice(0, 10)
    const todayRes = await fetch(`${COUNTER_API}/hit/${NAMESPACE}/${SITE_KEY}/views-${today}`)
    const todayData = await todayRes.json()

    return {
      total: viewsData.value || 0,
      today: todayData.value || 0,
    }
  } catch {
    return { total: 0, today: 0, error: true }
  }
}

/** Get current stats without incrementing */
export async function getStats() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const [totalRes, todayRes] = await Promise.all([
      fetch(`${COUNTER_API}/get/${NAMESPACE}/${SITE_KEY}/views`),
      fetch(`${COUNTER_API}/get/${NAMESPACE}/${SITE_KEY}/views-${today}`),
    ])
    const [totalData, todayData] = await Promise.all([totalRes.json(), todayRes.json()])
    return {
      total: totalData.value || 0,
      today: todayData.value || 0,
      activeUsers: getLocalActiveCount(),
    }
  } catch {
    return { total: 0, today: 0, activeUsers: 0, error: true }
  }
}

/** Track unique visitor */
export function getLocalVisitorInfo() {
  const id = getVisitorId()
  const firstVisit = localStorage.getItem('ds_first_visit') || new Date().toISOString()
  if (!localStorage.getItem('ds_first_visit')) {
    localStorage.setItem('ds_first_visit', firstVisit)
  }
  // Update last visit
  localStorage.setItem('ds_last_visit', new Date().toISOString())

  return { id, firstVisit, lastVisit: localStorage.getItem('ds_last_visit') }
}

/** Get count of local page visits stored in this browser */
function getLocalActiveCount() {
  // Check recent visits in localStorage
  const lastVisit = localStorage.getItem('ds_last_visit')
  if (lastVisit) {
    const lastTime = new Date(lastVisit).getTime()
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    return lastTime > fiveMinAgo ? 1 : 0
  }
  return 0
}

/** Record detailed visit data to localStorage for dashboard */
export function recordVisit() {
  const visits = JSON.parse(localStorage.getItem('ds_visits') || '[]')
  visits.push({
    time: new Date().toISOString(),
    visitorId: getVisitorId().slice(0, 12),
    userAgent: navigator.userAgent.slice(0, 80),
    screenSize: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
  })
  // Keep last 100 visits
  if (visits.length > 100) visits.splice(0, visits.length - 100)
  localStorage.setItem('ds_visits', JSON.stringify(visits))
}

/** Get all locally stored visits */
export function getLocalVisits() {
  try {
    return JSON.parse(localStorage.getItem('ds_visits') || '[]')
  } catch { return [] }
}

/** Get summary stats */
export function getSummary() {
  const visits = getLocalVisits()
  const now = Date.now()
  const last24h = now - 24 * 60 * 60 * 1000
  const last1h = now - 60 * 60 * 1000

  return {
    totalRecorded: visits.length,
    last24h: visits.filter((v) => new Date(v.time).getTime() > last24h).length,
    last1h: visits.filter((v) => new Date(v.time).getTime() > last1h).length,
    uniqueVisitors: new Set(visits.map((v) => v.visitorId)).size,
    firstVisit: visits[0]?.time || 'N/A',
    lastVisit: visits[visits.length - 1]?.time || 'N/A',
  }
}
