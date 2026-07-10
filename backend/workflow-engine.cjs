/**
 * Director Studio — Workflow Execution Engine
 * 接收 graph JSON → 拓扑排序 → 依次执行节点 → SSE 推送状态
 */
const https = require('https')
const http = require('http')

// In-memory run store (no Redis needed for MVP)
const runs = {}

// === TOPOLOGICAL SORT (Kahn) ===
function topoSort(nodes, edges) {
  const adj = {}; const inDeg = {}
  nodes.forEach(n => { adj[n.id] = []; inDeg[n.id] = 0 })
  edges.forEach(e => {
    if (adj[e.source] !== undefined && adj[e.target] !== undefined) {
      adj[e.source].push(e.target)
      inDeg[e.target] = (inDeg[e.target] || 0) + 1
    }
  })
  const queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id)
  const sorted = []
  while (queue.length) {
    const id = queue.shift(); sorted.push(id)
    for (const t of adj[id]) { inDeg[t]--; if (inDeg[t] === 0) queue.push(t) }
  }
  // Add any remaining (cycles or disconnected)
  nodes.forEach(n => { if (!sorted.includes(n.id)) sorted.push(n.id) })
  return sorted
}

// === NODE EXECUTORS ===
// Each executor receives: { node, graph, apiKeys, signal }
// Returns: { output data } or throws error

const executors = {
  textPrompt: async ({ node }) => {
    // TextPrompt doesn't need API call — it's just data passthrough
    return { status: 'done', output: { text: node.data?.prompt || '' } }
  },

  mediaGen: async ({ node, apiKeys, signal }) => {
    const isImage = node.data?.mediaType !== 'video'
    const prompt = node.data?.prompt || ''
    const provider = isImage ? (node.data?.modelProvider || 'openai') : (node.data?.modelProvider || 'seedance')
    
    if (!prompt && (isImage || !node.data?.sourceImage)) {
      return { status: 'error', error: '缺少提示词' }
    }

    // Route to appropriate API
    const keyMap = { openai: apiKeys.openai, seedance: apiKeys.seedance, kling: apiKeys.kling, wan: apiKeys.qwen, sora: apiKeys.openai }
    const apiKey = keyMap[provider]
    if (!apiKey && !['gpt-image-1','dall-e-3'].includes(node.data?.modelProvider)) {
      return { status: 'error', error: 缺少  API Key }
    }

    if (isImage) {
      // Call image generation API via the proxy pattern
      const body = JSON.stringify({
        model: node.data?.modelProvider || 'gpt-image-1',
        prompt: prompt,
        n: node.data?.imageCount || 1,
        size: node.data?.aspectRatio === '1:1' ? '1024x1024' : node.data?.aspectRatio === '16:9' ? '1792x1024' : '1024x1792',
        response_format: 'b64_json',
      })

      const result = await apiCall({
        hostname: 'api.openai.com',
        path: '/v1/images/generations',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': Bearer  },
        body,
        signal,
      })

      const images = (result.data || []).map(img => ({
        url: img.url,
        base64: img.b64_json ? data:image/png;base64, : null,
        revised_prompt: img.revised_prompt,
      }))
      return { status: 'done', output: { type: 'image', images } }
    } else {
      // Video generation — placeholder: return pending
      return { status: 'done', output: { type: 'video', url: null, message: '视频生成需轮询，请手动查看' } }
    }
  },

  agent: async ({ node, apiKeys, signal }) => {
    const prompt = node.data?.prompt || ''
    const mode = node.data?.agentMode || 'director'
    if (!prompt) return { status: 'error', error: '缺少输入文本' }

    // Use DeepSeek or OpenAI for agent
    const apiKey = apiKeys.deepseek || apiKeys.openai
    if (!apiKey) return { status: 'error', error: '缺少 API Key' }

    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 你是模式的AI助手，请用中文回复。 },
        { role: 'user', content: prompt }
      ],
      stream: false,
      max_tokens: 4000,
    })

    const result = await apiCall({
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': Bearer  },
      body,
      signal,
    })

    const text = result.choices?.[0]?.message?.content || ''
    return { status: 'done', output: { type: 'text', text } }
  },

  preview: async ({ node, graph }) => {
    // Preview is passive — gathers upstream output
    const upstreamEdge = graph.edges.find(e => e.target === node.id)
    if (upstreamEdge) {
      const srcNode = graph.nodes.find(n => n.id === upstreamEdge.source)
      return { status: 'done', output: srcNode?.executionResult?.output || {} }
    }
    return { status: 'done', output: {} }
  },

  reference: async ({ node }) => {
    return { status: 'done', output: { type: 'reference', data: node.data?.mediaData || null } }
  },

  reroute: async ({ node, graph }) => {
    const upstreamEdge = graph.edges.find(e => e.target === node.id)
    if (upstreamEdge) {
      const srcNode = graph.nodes.find(n => n.id === upstreamEdge.source)
      return { status: 'done', output: srcNode?.executionResult?.output || {} }
    }
    return { status: 'done', output: {} }
  },

  pixelleVideo: async ({ node, apiKeys, signal }) => {
    return { status: 'done', output: { type: 'video', message: '短视频生成待接入' } }
  },

  primitive: async ({ node }) => {
    return { status: 'done', output: { type: node.data?.valueType || 'string', value: node.data?.value || '' } }
  },
}

// === API CALL HELPER ===
function apiCall({ hostname, path, method, headers, body, signal }) {
  return new Promise((resolve, reject) => {
    const isHttps = hostname.includes('api.') && !hostname.includes('localhost')
    const mod = isHttps ? https : http
    const req = mod.request({ hostname, path, method, headers, timeout: 120000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve({ raw: data }) }
      })
    })
    req.on('error', reject)
    if (signal) signal.addEventListener('abort', () => req.destroy())
    if (body) req.write(body)
    req.end()
  })
}

// === SSE STREAM HELPERS ===
const sseClients = {} // runId -> [response objects]

function sseSend(runId, event, data) {
  const clients = sseClients[runId]
  if (!clients) return
  const payload = vent: \ndata: \n\n
  clients.forEach(res => { try { res.write(payload) } catch {} })
}

// === MAIN: Run workflow ===
async function executeWorkflow(runId, graph, apiKeys, config = {}) {
  const run = { id: runId, status: 'running', nodeStatus: {}, results: {}, startedAt: Date.now() }
  runs[runId] = run

  const sorted = topoSort(graph.nodes, graph.edges)
  const abortCtrl = new AbortController()
  run._abort = () => abortCtrl.abort()

  sseSend(runId, 'workflow:start', { runId, totalNodes: sorted.length, nodes: sorted })

  for (let i = 0; i < sorted.length; i++) {
    const nodeId = sorted[i]
    const node = graph.nodes.find(n => n.id === nodeId)
    if (!node) continue

    run.nodeStatus[nodeId] = 'running'
    sseSend(runId, 'node:start', { nodeId, index: i, total: sorted.length, type: node.type })

    try {
      const executor = executors[node.type]
      if (!executor) {
        run.nodeStatus[nodeId] = 'skipped'
        sseSend(runId, 'node:skipped', { nodeId, reason: 'no executor' })
        continue
      }

      // Progress simulation for long-running nodes
      let progressTimer = null
      if (node.type === 'mediaGen' && node.data?.mediaType !== 'video') {
        let p = 0
        progressTimer = setInterval(() => {
          p = Math.min(p + 15, 90)
          sseSend(runId, 'node:progress', { nodeId, progress: p })
        }, 800)
      }

      const result = await executor({ node, graph, apiKeys, signal: abortCtrl.signal })
      if (progressTimer) clearInterval(progressTimer)

      // Store result on node for downstream access
      node.executionResult = result
      run.results[nodeId] = result

      if (result.status === 'error') {
        run.nodeStatus[nodeId] = 'error'
        sseSend(runId, 'node:error', { nodeId, error: result.error })
        if (config.stopOnError) {
          sseSend(runId, 'workflow:stopped', { reason: 'error', nodeId })
          run.status = 'stopped'
          return run
        }
      } else {
        run.nodeStatus[nodeId] = 'done'
        sseSend(runId, 'node:done', { nodeId, output: result.output, index: i, total: sorted.length })
      }
    } catch (err) {
      run.nodeStatus[nodeId] = 'error'
      sseSend(runId, 'node:error', { nodeId, error: err.message })
      if (config.stopOnError) {
        sseSend(runId, 'workflow:stopped', { reason: 'error', nodeId })
        run.status = 'stopped'
        return run
      }
    }
  }

  run.status = 'done'
  sseSend(runId, 'workflow:done', { runId, duration: Date.now() - run.startedAt })
  return run
}

// === EXPORT ===
module.exports = { executeWorkflow, sseClients, sseSend, runs }
