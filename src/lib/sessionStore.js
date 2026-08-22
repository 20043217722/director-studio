/**
 * Multi-tab Agent Session Manager
 *
 * Each agent conversation is an independent session with its own:
 * - mode (agent type)
 * - messages (chat history)
 * - loading state
 * - abort controller
 *
 * Sessions persist in tabs; switching doesn't lose context.
 */

const HISTORY_PREFIX = "director_studio_history_";
const MAX_HISTORY = 100;
const MAX_HISTORY_SIZE = 2 * 1024 * 1024;

function getHistoryKey(mode) { return HISTORY_PREFIX + mode; }

export function loadSessionHistory(mode) {
  try {
    const raw = localStorage.getItem(getHistoryKey(mode));
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
  } catch (_) {}
  return [];
}

export function saveSessionHistory(mode, msgs) {
  try {
    let slim = msgs.slice(-MAX_HISTORY).map(({ id, role, text, error, time, liked }) => ({ id, role, text, error, time, liked: liked || false }));
    let json = JSON.stringify(slim);
    while (json.length > MAX_HISTORY_SIZE && slim.length > 10) {
      slim = slim.slice(Math.floor(slim.length / 2));
      json = JSON.stringify(slim);
    }
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith(HISTORY_PREFIX));
    if (allKeys.length > 0 && json.length > MAX_HISTORY_SIZE / 2) {
      for (const k of allKeys) {
        if (k !== getHistoryKey(mode)) {
          try { localStorage.removeItem(k); } catch (_) {}
          break;
        }
      }
    }
    localStorage.setItem(getHistoryKey(mode), json);
  } catch (_) {}
}

let _sessionCounter = 0;

export function createSession(mode) {
  return {
    id: 's_' + (++_sessionCounter) + '_' + Date.now(),
    mode,
    name: mode, // will be resolved to display name by AGENTS lookup
    messages: loadSessionHistory(mode),
    loading: false,
    abortRef: null,
    sendingRef: false,
  };
}
