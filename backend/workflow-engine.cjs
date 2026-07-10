/**
 * Director Studio — Workflow Execution Engine v2
 * 拓扑排序 + 并行执行独立分支 + 参数扫描引擎 + SSE 状态推送
 */
const https = require('https')
const http = require('http')

// In-memory run store
const runs = {}

// === TOPOLOGICAL SORT (Kahn) with layer grouping ===
function topoSortGrouped(nodes, edges) {
  const adj = {}; const inDeg = {}
  nodes.forEach(n => { adj[n.id] = []; inDeg[n.id] = 0 })
  edges.forEach(e => {
    if (adj[e.source] !== undefined && adj[e.target] !== undefined) {
      adj[e.source].push(e.target)
      inDeg[e.target] = (inDeg[e.target] || 0) + 1
    }
  })
  // Group by layers
  const layers = []
  let queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id)
  if (!queue.length) queue = [nodes[0]?.id].filter(Boolean)
  while (queue.length) {
    layers.push([...queue])
    const nextQueue = []
    for (const id of queue) {
      for (const t of adj[id]) { inDeg[t]--; if (inDeg[t] === 0) nextQueue.push(t) }
    }
    queue = nextQueue
  }
  // Add remaining
  const layerIds = new Set(layers.flat())
  nodes.forEach(n => { if (!layerIds.has(n.id)) layers.push([n.id]) })
  return layers
}

// === NODE EXECUTORS ===
const executors = {
  textPrompt: async ({ node }) => {
    return { status: 'done', output: { type: 'TEXT', text: node.data?.prompt || '', cached: true } }
  },

  mediaGen: async ({ node, apiKeys, signal, batchIndex }) => {
    const isImage = node.data?.mediaType !== 'video'
    const prompt = node.data?.prompt || ''
    if (!prompt && (isImage || !node.data?.sourceImage)) return { status: 'error', error: '缺少提示词' }
    if (!isImage) return { status: 'done', output: { type: 'VIDEO', message: '视频需轮询' } }

    const provider = node.data?.modelProvider || 'gpt-image-1'
    const size = node.data?.aspectRatio === '1:1' ? '1024x1024' : node.data?.aspectRatio === '16:9' ? '1792x1024' : '1024x1792'
    const seed = node.data?.seed !== undefined && node.data?.seed >= 0 ? node.data.seed : Math.floor(Math.random() * 2147483647)

    const body = JSON.stringify({ model: provider, prompt, n: 1, size, response_format: 'b64_json', seed })
    const result = await apiCall({
      hostname: 'api.openai.com', path: '/v1/images/generations', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': Bearer  },
      body, signal,
    })
    const images = (result.data || []).map(img => ({
      url: img.url, base64: img.b64_json ? data:image/png;base64, : null,
      revised_prompt: img.revised_prompt, seed,
    }))
    return { status: 'done', output: { type: 'IMAGE', images, seed, batchIndex }, cached: false }
  },

  agent: async ({ node, apiKeys, signal }) => {
    const prompt = node.data?.prompt || ''
    if (!prompt) return { status: 'error', error: '缺少输入文本' }
    const apiKey = apiKeys.deepseek || apiKeys.openai
    if (!apiKey) return { status: 'error', error: '缺少 API Key' }
    const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: '你是AI助手，请用中文回复。' }, { role: 'user', content: prompt }], stream: false, max_tokens: 4000 })
    const result = await apiCall({ hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': Bearer  }, body, signal })
    return { status: 'done', output: { type: 'TEXT', text: result.choices?.[0]?.message?.content || '' }, cached: false }
  },

  preview: async ({ node, graph }) => {
    const edge = graph.edges.find(e => e.target === node.id)
    if (edge) { const src = graph.nodes.find(n => n.id === edge.source); return { status: 'done', output: src?.executionResult?.output || {}, cached: true } }
    return { status: 'done', output: {}, cached: true }
  },

  reference: async ({ node }) => ({ status: 'done', output: { type: 'IMAGE', data: node.data?.mediaData }, cached: true }),
  reroute: async ({ node, graph }) => {
    const edge = graph.edges.find(e => e.target === node.id)
    if (edge) { const src = graph.nodes.find(n => n.id === edge.source); return { status: 'done', output: src?.executionResult?.output || {}, cached: true } }
    return { status: 'done', output: {}, cached: true }
  },
  pixelleVideo: async () => ({ status: 'done', output: { type: 'VIDEO', message: '待接入' }, cached: true }),
  primitive: async ({ node }) => ({ status: 'done', output: { type: node.data?.valueType || 'TEXT', value: node.data?.value }, cached: true }),
}

// === API CALL HELPER ===
function apiCall({ hostname, path, method, headers, body, signal }) {
  return new Promise((resolve, reject) => {
    const isHttps = hostname.includes('api.')
    const mod = isHttps ? https : http
    const req = mod.request({ hostname, path, method, headers, timeout: 180000 }, (res) => {
      let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve({ raw: data }) } })
    })
    req.on('error', reject)
    if (signal) signal.addEventListener('abort', () => req.destroy())
    if (body) req.write(body); req.end()
  })
}

// === SSE HELPERS ===
const sseClients = {}
function sseSend(runId, event, data) {
  const clients = sseClients[runId]; if (!clients) return
  const payload = vent: \ndata: \n\n
  clients.forEach(res => { try { res.write(payload) } catch {} })
  if (event === 'workflow:done' || event === 'workflow:stopped') {
    setTimeout(() => {
      clients.forEach(res => { try { res.end() } catch {} })
      delete sseClients[runId]
    }, 1000)
  }
}

// === PROGRESS SIMULATOR ===
function startProgress(runId, nodeId, totalMs = 5000) {
  let p = 0
  const interval = setInterval(() => {
    p = Math.min(p + (100 / (totalMs / 500)), 90)
    sseSend(runId, 'node:progress', { nodeId, progress: Math.round(p) })
    if (p >= 90) clearInterval(interval)
  }, 500)
  return () => { clearInterval(interval); sseSend(runId, 'node:progress', { nodeId, progress: 100 }) }
}

// === MAIN: Execute workflow with PARALLEL execution ===
async function executeWorkflow(runId, graph, apiKeys, config = {}) {
  const run = { id: runId, status: 'running', nodeStatus: {}, results: {}, startedAt: Date.now() }
  runs[runId] = run
  run._abort = () => { run._aborted = true }
  const layers = topoSortGrouped(graph.nodes, graph.edges)
  sseSend(runId, 'workflow:start', { runId, totalNodes: graph.nodes.length, layers: layers.length })

  for (let li = 0; li < layers.length; li++) {
    if (run._aborted) { sseSend(runId, 'workflow:stopped', { reason: 'aborted' }); run.status = 'stopped'; return run }
    const layer = layers[li]
    const layerNodes = layer.map(id => graph.nodes.find(n => n.id === id)).filter(Boolean)
    
    sseSend(runId, 'layer:start', { layer: li, nodes: layer, totalLayers: layers.length })
    
    // PARALLEL execution within layer
    const promises = layerNodes.map(async (node) => {
      run.nodeStatus[node.id] = 'running'
      sseSend(runId, 'node:start', { nodeId: node.id, layer: li, type: node.type })
      const clearProgress = startProgress(runId, node.id, node.type === 'mediaGen' ? 15000 : 3000)
      try {
        const executor = executors[node.type]
        if (!executor) { run.nodeStatus[node.id] = 'skipped'; sseSend(runId, 'node:skipped', { nodeId: node.id }); clearProgress(); return }
        const result = await executor({ node, graph, apiKeys, signal: { aborted: false } })
        clearProgress()
        node.executionResult = result; run.results[node.id] = result
        if (result.status === 'error') {
          run.nodeStatus[node.id] = 'error'; sseSend(runId, 'node:error', { nodeId: node.id, error: result.error })
        } else {
          run.nodeStatus[node.id] = 'done'
          sseSend(runId, 'node:done', { nodeId: node.id, output: result.output, cached: result.cached, layer: li })
        }
      } catch (err) {
        clearProgress(); run.nodeStatus[node.id] = 'error'
        sseSend(runId, 'node:error', { nodeId: node.id, error: err.message })
      }
    })
    
    await Promise.all(promises)
    if (run._aborted) break
  }

  const done = Object.values(run.nodeStatus).filter(s => s === 'done').length
  run.status = run._aborted ? 'stopped' : 'done'
  sseSend(runId, 'workflow:done', { runId, duration: Date.now() - run.startedAt, done, total: Object.keys(run.nodeStatus).length, cached: done })
  return run
}

// === BATCH/PARAMETER SCAN ===
async function executeBatch(runId, nodeId, paramGrid, apiKeys, config = {}) {
  const run = { id: runId, status: 'running', nodeStatus: {}, results: {}, startedAt: Date.now(), batch: true }
  runs[runId] = run
  sseSend(runId, 'workflow:start', { runId, totalNodes: paramGrid.length, batch: true })

  const promises = paramGrid.map(async (params, i) => {
    const batchNode = { id: nodeId + '_b' + i, type: params.type || 'mediaGen', data: { ...params, mediaType: 'image' } }
    run.nodeStatus[batchNode.id] = 'running'
    sseSend(runId, 'node:start', { nodeId: batchNode.id, batchIdx: i, type: 'mediaGen' })
    const clearProgress = startProgress(runId, batchNode.id, 15000)
    try {
      const result = await executors.mediaGen({ node: batchNode, apiKeys, signal: { aborted: false }, batchIndex: i })
      clearProgress()
      run.results[batchNode.id] = result
      if (result.status === 'error') {
        run.nodeStatus[batchNode.id] = 'error'; sseSend(runId, 'node:error', { nodeId: batchNode.id, batchIdx: i, error: result.error })
      } else {
        run.nodeStatus[batchNode.id] = 'done'
        sseSend(runId, 'node:done', { nodeId: batchNode.id, batchIdx: i, output: result.output })
      }
    } catch (err) {
      clearProgress()
      run.nodeStatus[batchNode.id] = 'error'; sseSend(runId, 'node:error', { nodeId: batchNode.id, batchIdx: i, error: err.message })
    }
  })

  await Promise.all(promises)
  run.status = 'done'
  sseSend(runId, 'workflow:done', { runId, duration: Date.now() - run.startedAt, batch: true })
  return run
}

// === RUN HISTORY (in-memory, no DB for MVP) ===
function getRunHistory(limit = 20) {
  return Object.values(runs).filter(r => r.status === 'done' || r.status === 'stopped').sort((a, b) => b.startedAt - a.startedAt).slice(0, limit).map(r => ({
    id: r.id, status: r.status, duration: r.duration || (Date.now() - r.startedAt),
    totalNodes: Object.keys(r.nodeStatus).length,
    doneNodes: Object.values(r.nodeStatus).filter(s => s === 'done').length,
    errorNodes: Object.values(r.nodeStatus).filter(s => s === 'error').length,
    batch: r.batch || false,
    startedAt: r.startedAt,
  }))
}

module.exports = { executeWorkflow, executeBatch, sseClients, sseSend, runs, getRunHistory }
