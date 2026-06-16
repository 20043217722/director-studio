/**
 * Canvas API — Image & Video Generation
 * Reuses api.js auth infrastructure (loadKeys, proxy, circuit breaker)
 */
const getApiKey = (provider) => {
  try {
    const keys = JSON.parse(localStorage.getItem('api_keys') || '{}')
    return keys[provider] || ''
  } catch { return '' }
}

const getProxy = () => localStorage.getItem('api_proxy_url') || ''

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: options.signal,
        headers: { ...options.headers },
      })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        if (res.status === 429 && i < retries - 1) {
          await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
          continue
        }
        throw new Error(`API 错误 ${res.status}: ${err.slice(0, 200)}`)
      }
      return res
    } catch (e) {
      if (e.name === 'AbortError') throw e
      if (i === retries - 1) throw e
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

// ===== Image Generation =====
export async function generateImage(prompt, {
  provider = 'openai',
  aspectRatio = '1:1',
  negativePrompt = '',
  count = 1,
  signal,
} = {}) {
  const key = getApiKey(provider)
  if (!key) throw new Error(`请先在设置中配置 ${provider} 的 API Key`)

  if (provider === 'openai') {
    const endpoint = getProxy() || 'https://api.openai.com/v1/images/generations'
    const size = aspectRatio === '16:9' ? '1792x1024' : aspectRatio === '9:16' ? '1024x1792' : '1024x1024'
    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: Math.min(count, 1), size, quality: 'hd' }),
      signal,
    })
    const data = await res.json()
    return { images: (data.data || []).map((d) => ({ url: d.url, revised_prompt: d.revised_prompt })) }
  }

  // Generic OpenAI-compatible image endpoint
  const endpoint = getProxy() || 'https://api.openai.com/v1/images/generations'
  const res = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'dall-e-3', prompt, n: count, size: '1024x1024' }),
    signal,
  })
  const data = await res.json()
  return { images: (data.data || []).map((d) => ({ url: d.url })) }
}

// ===== Video Generation =====
export async function generateVideo(promptOrImage, {
  provider = 'seedance',
  duration = 5,
  signal,
} = {}) {
  const key = getApiKey(provider)
  if (!key) throw new Error(`请先在设置中配置 ${provider} 的 API Key`)

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
  if (!data.jobId && !data.id) {
    // If API creates directly (sync), return URL
    if (data.url) return { url: data.url, jobId: null }
    throw new Error('视频生成请求失败：未返回任务ID')
  }
  return { jobId: data.jobId || data.id }
}

export async function* pollVideoGeneration(jobId, {
  provider = 'seedance',
  signal,
  interval = 3000,
  maxAttempts = 60,
} = {}) {
  const key = getApiKey(provider)
  const endpoint = getProxy() || `https://api.seedance.com/v1/videos/${jobId}`

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) break
    await new Promise((r) => setTimeout(r, interval))

    const res = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${key}` },
      signal,
    }).catch(() => null)

    if (!res || !res.ok) continue
    const data = await res.json()

    const progress = data.progress || (data.status === 'completed' ? 100 : Math.min(i * 3, 90))
    yield { progress, status: data.status === 'completed' ? 'done' : 'generating' }

    if (data.status === 'completed' || data.url) {
      yield { progress: 100, status: 'done', url: data.url }
      return
    }
    if (data.status === 'failed') {
      throw new Error(data.error || '视频生成失败')
    }
  }

  throw new Error('视频生成超时，请重试')
}
