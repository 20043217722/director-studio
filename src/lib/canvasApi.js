/**
 * Canvas API — Image & Video Generation
 * Reuses api.js auth: same localStorage keys, proxy, retry
 */

// Same key store as api.js (shared localStorage key)
const getKeys = () => { try { return JSON.parse(localStorage.getItem('api_keys') || '{}') } catch { return {} } }

// Auto-detect backend proxy: if running, no API key needed
const PROXY_URL = 'http://localhost:3001'
let proxyAvailable = null  // null=unknown, true/false after check

async function checkProxy() {
  if (proxyAvailable !== null) return proxyAvailable
  try {
    const res = await fetch(`${PROXY_URL}/health`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      const data = await res.json()
      proxyAvailable = data.status === 'ok'
      if (proxyAvailable) console.log(`[Canvas] Proxy detected — ${(data.configured||[]).length} keys configured`)
    } else {
      proxyAvailable = false
    }
  } catch { proxyAvailable = false }
  return proxyAvailable
}

function getProxyEndpoint(targetUrl) {
  // If backend proxy is running, route through it (no API key needed)
  // Otherwise, use user-configured proxy or direct
  return `${PROXY_URL}/api/${targetUrl}`
}

function getUserProxy() {
  return localStorage.getItem('api_proxy_url') || ''
}

// Key alias mapping — many image/video APIs reuse chat API keys
const KEY_ALIAS = {
  // Image models reusing chat keys
  'dall-e-3': 'openai',       // DALL·E 3 → OpenAI key
  'gpt-image-1': 'openai',    // GPT-4o image → OpenAI key
  'seedream': 'seedance',     // Seedream → Seedance key
  'qwen-image': 'qwen',       // 通义万相 → 通义千问 key
  'cogview': 'glm',           // CogView → GLM key
  'minimax-image': 'minimax', // 海螺 → MiniMax key
  'flux': 'openai',           // Flux (OpenAI route) → OpenAI key
  // Video models reusing chat keys
  'sora': 'openai',           // Sora 2 → OpenAI key
  'kling': 'kling',           // 可灵 → dedicated key (if configured)
  'wan': 'qwen',              // Wan → 通义千问 key
  'minimax-video': 'minimax', // 海螺视频 → MiniMax key
  'gemini': 'gemini',         // Gemini → dedicated key
  // Agnes AI models (all share the same agnes key)
  'agnes-image': 'agnes',     // Agnes 生图 → Agnes key
  'agnes-video': 'agnes',     // Agnes 生视频 → Agnes key
}

function getResolvedKey(provider) {
  const keys = getKeys()
  // Try direct match first
  if (keys[provider]) return { key: keys[provider], source: provider }
  // Try alias
  const alias = KEY_ALIAS[provider]
  if (alias && keys[alias]) return { key: keys[alias], source: alias }
  return { key: '', source: null }
}

function hasKey(provider) {
  return !!getResolvedKey(provider).key
}

async function fetchWithRetry(url, options, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { ...options, signal: options.signal })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        if (res.status === 429 && i < retries) {
          await new Promise(r => setTimeout(r, 2000 * (i + 1)))
          continue
        }
        throw new Error(`API ${res.status}: ${err.slice(0, 200)}`)
      }
      return res
    } catch (e) {
      if (e.name === 'AbortError') throw e
      if (i === retries) throw e
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

// ===== Image Generation =====
export async function generateImage(prompt, {
  provider = 'gpt-image-1',
  aspectRatio = '1:1',
  negativePrompt = '',
  count = 1,
  signal,
} = {}) {
  // Try backend proxy first (no key needed)
  const useProxy = await checkProxy()
  const { key } = getResolvedKey(provider)
  if (!useProxy && !key) {
    const name = provider === 'gpt-image-1' ? 'GPT-4o 图片生成' : provider
    throw new Error(`请启动后端代理 (npm run proxy) 或在设置中配置 API Key（${name}）`)
  }

  // === GPT-4o Image ===
  if (provider === 'gpt-image-1') {
    const baseEndpoint = 'https://api.openai.com/v1/chat/completions'
    const endpoint = useProxy ? getProxyEndpoint(baseEndpoint) : (getUserProxy() || baseEndpoint)
    const sizeMap = { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792' }
    const size = sizeMap[aspectRatio] || '1024x1024'

    const body = {
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Generate an image: ${prompt}${negativePrompt ? `. Avoid: ${negativePrompt}` : ''}. Image size: ${size}.`
      }],
      max_tokens: 4096,
    }

    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body),
      signal,
    })
    const data = await res.json()

    // Extract image URLs from response (GPT-4o returns markdown/image references)
    const images = []
    const content = data.choices?.[0]?.message?.content || ''
    // Try to find generated image URLs
    const urlMatch = content.match(/https?:\/\/[^\s"')]+\.(png|jpg|jpeg|webp)/gi)
    if (urlMatch) {
      images.push(...urlMatch.map(u => ({ url: u })))
    }
    if (!images.length) {
      // Fallback: try DALL·E 3
      return generateImage(prompt, { provider: 'dall-e-3', aspectRatio, negativePrompt, count, signal })
    }
    return { images, model: 'GPT-4o' }
  }

  // === Agnes AI Image Generation ===
  if (provider === 'agnes-image') {
    const baseEndpoint = 'https://apihub.agnes-ai.com/v1/images/generations'
    const endpoint = useProxy ? getProxyEndpoint(baseEndpoint) : (getUserProxy() || baseEndpoint)
    const sizeMap = { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792' }
    const size = sizeMap[aspectRatio] || '1024x1024'

    const body = {
      model: 'agnes-image-2.1-flash',
      prompt,
      size,
    }
    if (negativePrompt) body.negative_prompt = negativePrompt

    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body),
      signal,
    })
    const data = await res.json()
    if (data.data && data.data.length > 0) {
      return { images: data.data.map(d => ({ url: d.url, revised_prompt: d.revised_prompt })), model: 'Agnes Image 2.1' }
    }
    // Some responses return direct URL
    if (data.url) return { images: [{ url: data.url }], model: 'Agnes Image 2.1' }
    throw new Error('Agnes 生图失败：未返回图片URL')
  }

  // === DALL·E 3 ===
  if (provider === 'dall-e-3') {
    const baseEndpoint = 'https://api.openai.com/v1/images/generations'
    const endpoint = useProxy ? getProxyEndpoint(baseEndpoint) : (getUserProxy() || baseEndpoint)
    const sizeMap = { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792' }
    const size = sizeMap[aspectRatio] || '1024x1024'

    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: Math.min(count, 1), size, quality: 'hd' }),
      signal,
    })
    const data = await res.json()
    return { images: (data.data || []).map(d => ({ url: d.url, revised_prompt: d.revised_prompt })), model: 'DALL·E 3' }
  }

  // === Generic OpenAI-compatible image endpoint ===
  const endpoint = getProxy() || 'https://api.openai.com/v1/images/generations'
  const res = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'dall-e-3', prompt, n: count, size: '1024x1024' }),
    signal,
  })
  const data = await res.json()
  return { images: (data.data || []).map(d => ({ url: d.url })) }
}

// ===== Video Generation =====
export async function generateVideo(promptOrImage, {
  provider = 'sora',  // Default: Sora 2 (reuses OpenAI key)
  duration = 5,
  signal,
} = {}) {
  const { key, source } = getResolvedKey(provider)
  if (!key) {
    throw new Error(`请在设置中配置 API Key（${provider} 需要专用 Key）`)
  }

  // === Agnes AI Video Generation ===
  if (provider === 'agnes-video') {
    const baseEndpoint = 'https://apihub.agnes-ai.com/v1/videos'
    const endpoint = getUserProxy() || baseEndpoint
    const isImage = typeof promptOrImage === 'string' && promptOrImage.startsWith('data:')

    // num_frames must satisfy 8n+1 and ≤ 441
    const frameRate = 24
    const numFrames = Math.min(duration * frameRate, 441)
    // Round to nearest 8n+1
    const adjustedFrames = Math.floor((numFrames - 1) / 8) * 8 + 1

    const body = {
      model: 'agnes-video-v2.0',
      height: 768,
      width: 1152,
      num_frames: adjustedFrames,
      frame_rate: frameRate,
    }
    if (isImage) {
      body.image = promptOrImage
    } else {
      body.prompt = promptOrImage
    }

    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body),
      signal,
    })
    const data = await res.json()
    // Agnes returns video_id for async polling
    if (data.video_id) return { jobId: data.video_id, provider: 'agnes-video' }
    if (data.id) return { jobId: data.id, provider: 'agnes-video' }
    if (data.url) return { url: data.url, jobId: null }
    throw new Error('Agnes 视频生成请求失败：未返回 video_id')
  }

  // === Sora 2 (OpenAI) ===
  if (provider === 'sora') {
    const baseEndpoint = 'https://api.openai.com/v1/videos'
    const endpoint = useProxy ? getProxyEndpoint(baseEndpoint) : (getUserProxy() || baseEndpoint)
    const isImage = typeof promptOrImage === 'string' && promptOrImage.startsWith('data:')
    const body = isImage
      ? { model: 'sora-2', image: promptOrImage, duration_seconds: duration }
      : { model: 'sora-2', prompt: promptOrImage, duration_seconds: duration }

    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body),
      signal,
    })
    const data = await res.json()
    if (data.id) return { jobId: data.id }
    if (data.url) return { url: data.url, jobId: null }
    throw new Error('Sora 请求失败：未返回任务ID')
  }

  // === Generic video endpoint ===
  const endpoint = getProxy() || 'https://api.seedance.com/v1/videos'
  const isImage = typeof promptOrImage === 'string' && promptOrImage.startsWith('data:')
  const body = isImage
    ? { image: promptOrImage, duration }
    : { prompt: promptOrImage, duration }

  const res = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body),
    signal,
  })
  const data = await res.json()
  return { jobId: data.jobId || data.id || null, url: data.url || null }
}

export async function* pollVideoGeneration(jobId, {
  provider = 'sora',
  signal,
  interval = 5000,
  maxAttempts = 80,
} = {}) {
  const { key } = getResolvedKey(provider)
  if (!jobId) { yield { progress: 100, status: 'done' }; return }

  // === Agnes AI Video Polling ===
  if (provider === 'agnes-video') {
    const baseEndpoint = `https://apihub.agnes-ai.com/agnesapi?video_id=${jobId}`
    const endpoint = getUserProxy() || baseEndpoint
    let consecutiveFailures = 0
    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) break
      await new Promise(r => setTimeout(r, interval))
      // Retry on network errors up to 5 times before giving up
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${key}` },
        signal,
      }).catch(() => null)
      if (!res) {
        consecutiveFailures++
        if (consecutiveFailures > 5) throw new Error('视频生成中断：网络连接失败，请检查网络后重试')
        yield { progress: Math.min(i * 1.5, 90), status: 'generating', stage: '重连中...' }
        continue
      }
      consecutiveFailures = 0
      if (!res.ok) {
        if (res.status === 429) {
          // Rate limited — wait longer
          await new Promise(r => setTimeout(r, 8000))
          continue
        }
        yield { progress: Math.min(i * 1.5, 90), status: 'generating', stage: '等待中...' }
        continue
      }
      const data = await res.json()
      const status = data.status || data.state || 'processing'
      if (status === 'completed' || status === 'done' || status === 'succeeded' || data.url || data.video_url) {
        yield { progress: 100, status: 'done', url: data.url || data.video_url }
        return
      }
      if (status === 'failed' || status === 'error') {
        throw new Error(data.error || data.message || 'Agnes 视频生成失败')
      }
      // Smarter progress: fast start, slow middle, fast end
      let progress
      const elapsed = i * (interval / 1000)
      if (elapsed < 10) progress = Math.min(elapsed * 5, 30)        // 0-30% in first 10s
      else if (elapsed < 60) progress = 30 + (elapsed - 10) * 0.8  // 30-70% in 10-60s
      else progress = 70 + Math.min((elapsed - 60) * 0.4, 25)      // 70-95% in 60-120s+

      // Stage labels for better UX
      let stage = '生成中...'
      if (elapsed < 5) stage = '排队中...'
      else if (elapsed < 15) stage = '生成中...'
      else if (elapsed < 60) stage = '渲染中...'
      else stage = '即将完成...'

      yield { progress: Math.round(Math.min(progress, 95)), status: 'generating', stage }
    }
    throw new Error('视频生成超时(6分钟)，请重试。长视频需要更长时间，可尝试缩短时长。')
  }

  // Sora 2 polling
  if (provider === 'sora') {
    const useProxy = await checkProxy()
    const baseEndpoint = `https://api.openai.com/v1/videos/${jobId}`
    const endpoint = useProxy ? getProxyEndpoint(baseEndpoint) : (getUserProxy() || baseEndpoint)
    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) break
      await new Promise(r => setTimeout(r, interval))
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${key}` },
        signal,
      }).catch(() => null)
      if (!res?.ok) continue
      const data = await res.json()
      const progress = data.status === 'completed' ? 100 : Math.min(i * 3, 90)
      yield { progress, status: data.status === 'completed' ? 'done' : 'generating' }
      if (data.status === 'completed' || data.url || data.video_url) {
        yield { progress: 100, status: 'done', url: data.url || data.video_url }
        return
      }
      if (data.status === 'failed') throw new Error(data.error || '视频生成失败')
    }
    throw new Error('视频生成超时，请重试')
  }

  // Generic polling
  const endpoint = getProxy() || `https://api.seedance.com/v1/videos/${jobId}`
  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) break
    await new Promise(r => setTimeout(r, interval))
    const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${key}` }, signal }).catch(() => null)
    if (!res?.ok) continue
    const data = await res.json()
    const progress = data.status === 'completed' ? 100 : Math.min(i * 2, 90)
    yield { progress, status: data.status === 'completed' ? 'done' : 'generating' }
    if (data.status === 'completed' || data.url) { yield { progress: 100, status: 'done', url: data.url }; return }
    if (data.status === 'failed') throw new Error(data.error || '视频生成失败')
  }
  throw new Error('视频生成超时')
}

// ===== Pixelle-Video Integration =====
const PIXELLE_BASE = 'http://localhost:8000'

/**
 * Generate a full short video via Pixelle-Video (async)
 * Pixelle-Video must be running: docker compose up -d or uv run
 */
export async function generatePixelleVideo(topic, {
  nScenes = 5,
  template = '1080x1920/image_default.html',
  tts = 'edge',
  bgm = 'uplift',
  signal,
} = {}) {
  // Try the Pixelle-Video API directly
  const endpoint = `${PIXELLE_BASE}/api/video/generate/async`
  const body = {
    text: topic,
    mode: 'generate',
    n_scenes: nScenes,
    frame_template: template,
    tts_workflow: tts === 'index' ? 'tts_index.json' : 'tts_edge.json',
    template_params: {
      bgm_style: bgm,
      accent_color: '#8b5cf6',
      font_size: 48,
    },
  }

  const res = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const data = await res.json()
  if (data.task_id) return { taskId: data.task_id }
  throw new Error('Pixelle-Video 未返回 task_id，请确认服务已启动 (http://localhost:8000)')
}

/**
 * Poll Pixelle-Video async task progress
 * Yields { progress, status, stage, url }
 */
export async function* pollPixelleVideo(taskId, {
  signal,
  interval = 2000,
  maxAttempts = 120,  // Video generation can take 2-4 minutes
} = {}) {
  if (!taskId) { yield { progress: 100, status: 'done' }; return }

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) break
    await new Promise(r => setTimeout(r, interval))

    const endpoint = `${PIXELLE_BASE}/api/tasks/${taskId}`
    const res = await fetch(endpoint, { signal }).catch(() => null)
    if (!res?.ok) continue

    const data = await res.json()

    // Map Pixelle-Video status to our progress model
    const stageMap = {
      'init': 'init', 'script': 'script', 'title': 'title',
      'planning': 'planning', 'storyboard': 'storyboard',
      'media': 'media', 'compositing': 'compositing', 'finalize': 'finalize',
    }
    const stage = stageMap[data.stage] || data.stage || ''
    const progress = data.progress || Math.min(i * 1.2, 95)

    if (data.status === 'completed') {
      yield { progress: 100, status: 'done', stage: 'finalize', url: data.result?.video_url || data.video_url }
      return
    }
    if (data.status === 'failed') {
      throw new Error(data.error || data.message || 'Pixelle-Video 生成失败')
    }
    yield { progress: Math.round(progress), status: 'generating', stage }
  }
  throw new Error('视频生成超时（4分钟），请检查 Pixelle-Video 服务状态')
}

// Export for node UI to check key availability
export { hasKey, getResolvedKey }
