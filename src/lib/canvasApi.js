/**
 * Canvas API — Image & Video Generation
 * Reuses api.js auth: same localStorage keys, proxy, retry
 */

// Same key store as api.js (shared localStorage key)
const getKeys = () => { try { return JSON.parse(localStorage.getItem('api_keys') || '{}') } catch { return {} } }
const getProxy = () => localStorage.getItem('api_proxy_url') || ''

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
  provider = 'gpt-image-1',  // Default: GPT-4o image (reuses OpenAI key)
  aspectRatio = '1:1',
  negativePrompt = '',
  count = 1,
  signal,
} = {}) {
  const { key, source } = getResolvedKey(provider)
  if (!key) {
    const name = provider === 'gpt-image-1' ? 'GPT-4o 图片生成' : provider
    throw new Error(`请在设置中配置 API Key（${name} 需要 ${provider === 'gpt-image-1' ? 'OpenAI' : provider} Key）`)
  }

  // === GPT-4o Image (OpenAI Chat Completions API with image output) ===
  if (provider === 'gpt-image-1') {
    const endpoint = getProxy() || 'https://api.openai.com/v1/chat/completions'
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

  // === DALL·E 3 ===
  if (provider === 'dall-e-3') {
    const endpoint = getProxy() || 'https://api.openai.com/v1/images/generations'
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

  // === Sora 2 (OpenAI) ===
  if (provider === 'sora') {
    const endpoint = getProxy() || 'https://api.openai.com/v1/videos'
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
  interval = 3000,
  maxAttempts = 40,
} = {}) {
  const { key } = getResolvedKey(provider)
  if (!jobId) { yield { progress: 100, status: 'done' }; return }

  // Sora 2 polling
  if (provider === 'sora') {
    const endpoint = getProxy() || `https://api.openai.com/v1/videos/${jobId}`
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
  for (let i = 0; i < 30; i++) {
    if (signal?.aborted) break
    await new Promise(r => setTimeout(r, interval))
    const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${key}` }, signal }).catch(() => null)
    if (!res?.ok) continue
    const data = await res.json()
    const progress = data.status === 'completed' ? 100 : Math.min(i * 3, 90)
    yield { progress, status: data.status === 'completed' ? 'done' : 'generating' }
    if (data.status === 'completed' || data.url) { yield { progress: 100, status: 'done', url: data.url }; return }
    if (data.status === 'failed') throw new Error(data.error || '视频生成失败')
  }
  throw new Error('视频生成超时')
}

// Export for node UI to check key availability
export { hasKey, getResolvedKey }
