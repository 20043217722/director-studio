import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { nodeDefaults, validConnections, HANDLE_IDS, NODE_ALIASES } from './nodeDefaults'

const STORAGE_KEY = 'director_studio_canvas'
const MAX_UNDO = 50
const MAX_NODES = 100

// Edge label by data type flowing through the connection
const EDGE_LABELS = {
  textPrompt: { imageGen: '📝 提示词', videoGen: '📝 提示词', agent: '📝 提示词', pixelleVideo: '📝 文本' },
  imageGen: { preview: '🖼️ 图片', videoGen: '🖼️ 图→视频', agent: '🖼️ 视觉参考' },
  videoGen: { preview: '🎬 视频' },
  reference: { imageGen: '📎 参考图', videoGen: '📎 参考素材' },
  agent: { preview: '📄 分析结果' },
  pixelleVideo: { preview: '🎞️ 成品视频' },
  mediaGen: { preview: '🎨 媒体输出', videoGen: '🖼️ 图→视频', agent: '🖼️ 视觉参考' },
}

function getEdgeLabel(sourceType, targetType) {
  return EDGE_LABELS[sourceType]?.[targetType] || ''
}

// ===== Data Flow Engine =====
// Propagates data through connected nodes automatically

function getDownstreamTargets(nodeId, nodes, edges) {
  // Find all edges where this node is source, return target node IDs
  return edges.filter(e => e.source === nodeId).map(e => e.target)
}

function getUpstreamSources(nodeId, nodes, edges) {
  // Find all edges where this node is target, return source node IDs
  return edges.filter(e => e.target === nodeId).map(e => e.source)
}

// Resolve effective type (legacy aliases → current type)
function effectiveType(type) { return NODE_ALIASES[type] || type }

// Validate connection with full handle-ID check (shared by isValidConnection + onConnect)
export function validateConnection(sourceNode, targetNode, targetHandle) {
  if (!sourceNode || !targetNode) return false
  const allowed = validConnections[sourceNode.type]
  if (!allowed || !allowed[targetNode.type]) return false
  // Handle-level check: if target handle specified, must be in the allowed list
  const expected = allowed[targetNode.type]
  if (expected?.length && targetHandle) {
    return expected.includes(targetHandle)
  }
  return true
}

function syncNodeDownstream(sourceId, nodes, edges) {
  // Propagate source node's data to all connected downstream nodes
  const sourceNode = nodes.find(n => n.id === sourceId)
  if (!sourceNode) return nodes

  const targets = getDownstreamTargets(sourceId, nodes, edges)
  if (!targets.length) return nodes

  const updated = [...nodes]
  const srcData = sourceNode.data

  for (const targetId of targets) {
    const idx = updated.findIndex(n => n.id === targetId)
    if (idx === -1) continue
    const target = updated[idx]

    // Data flow rules by source → target type
    if (sourceNode.type === 'textPrompt') {
      // TextPrompt → ImageGen/VideoGen/Agent: push prompt text
      if (target.type === 'imageGen' || target.type === 'videoGen' || target.type === 'agent' || target.type === 'pixelleVideo') {
        if (srcData.prompt && !target.data.prompt) {
          updated[idx] = { ...target, data: { ...target.data, prompt: srcData.prompt } }
        }
      }
    }

    if (sourceNode.type === 'imageGen') {
      // ImageGen → Preview: push generated images
      if (target.type === 'preview' && srcData.generatedImages?.length) {
        updated[idx] = {
          ...target,
          data: {
            ...target.data,
            outputType: 'image',
            outputContent: srcData.generatedImages[0],
            status: srcData.status,
          }
        }
      }
      // ImageGen → VideoGen: push generated image as source
      if (target.type === 'videoGen' && srcData.generatedImages?.length) {
        const img = srcData.generatedImages[0]
        if (img && !target.data.sourceImage) {
          updated[idx] = {
            ...target,
            data: { ...target.data, sourceImage: img.url || img.base64 }
          }
        }
      }
    }

    if (sourceNode.type === 'videoGen') {
      // VideoGen → Preview: push generated video
      if (target.type === 'preview' && srcData.generatedVideo?.url) {
        updated[idx] = {
          ...target,
          data: {
            ...target.data,
            outputType: 'video',
            outputContent: srcData.generatedVideo,
            status: srcData.status,
          }
        }
      }
    }

    if (sourceNode.type === 'reference') {
      // Reference → ImageGen/VideoGen: push media as prompt source
      if ((target.type === 'imageGen' || target.type === 'videoGen') && srcData.mediaData) {
        updated[idx] = {
          ...target,
          data: { ...target.data, sourceImage: srcData.mediaData }
        }
      }
    }

    if (sourceNode.type === 'agent') {
      // Agent → Preview: push response text
      if (target.type === 'preview' && srcData.response) {
        updated[idx] = {
          ...target,
          data: { ...target.data, outputType: 'image', outputContent: null, response: srcData.response }
        }
      }
    }

    if (sourceNode.type === 'pixelleVideo') {
      // PixelleVideo → Preview: push generated video
      if (target.type === 'preview' && srcData.generatedVideo?.url) {
        updated[idx] = {
          ...target,
          data: {
            ...target.data,
            outputType: 'video',
            outputContent: srcData.generatedVideo,
            status: srcData.status,
          }
        }
      }
    }

    if (sourceNode.type === 'mediaGen') {
      // MediaGen → Preview: push image or video based on mediaType
      if (target.type === 'preview') {
        const isImage = srcData.mediaType !== 'video'
        if (isImage && srcData.generatedImages?.length) {
          updated[idx] = {
            ...target, data: { ...target.data, outputType: 'image',
              outputContent: srcData.generatedImages[0], status: srcData.status }
          }
        } else if (!isImage && srcData.generatedVideo?.url) {
          updated[idx] = {
            ...target, data: { ...target.data, outputType: 'video',
              outputContent: srcData.generatedVideo, status: srcData.status }
          }
        }
      }
      // MediaGen (image mode) → VideoGen: push source image
      if (target.type === 'videoGen' && srcData.mediaType !== 'video' && srcData.generatedImages?.length) {
        const img = srcData.generatedImages[0]
        if (img && !target.data.sourceImage) {
          updated[idx] = { ...target, data: { ...target.data, sourceImage: img.url || img.base64 } }
        }
      }
      // MediaGen → Agent: push prompt
      if (target.type === 'agent' && srcData.prompt && !target.data.prompt) {
        updated[idx] = { ...target, data: { ...target.data, prompt: srcData.prompt } }
      }
    }
  }

  return updated
}

function syncNodeUpstream(targetId, nodes, edges) {
  // Pull data from upstream sources into this node
  const targetNode = nodes.find(n => n.id === targetId)
  if (!targetNode) return nodes

  const sources = getUpstreamSources(targetId, nodes, edges)
  if (!sources.length) return nodes

  const updated = [...nodes]
  const idx = updated.findIndex(n => n.id === targetId)

  for (const sourceId of sources) {
    const source = updated.find(n => n.id === sourceId)
    if (!source) continue

    // Auto-fill target data from source
    if (source.type === 'textPrompt' && source.data.prompt) {
      if (targetNode.type === 'imageGen' || targetNode.type === 'videoGen' || targetNode.type === 'agent' || targetNode.type === 'pixelleVideo' || targetNode.type === 'mediaGen') {
        if (!targetNode.data.prompt || targetNode.data.prompt === source.data.prompt) {
          updated[idx] = { ...updated[idx], data: { ...updated[idx].data, prompt: source.data.prompt } }
        }
      }
    }
  }

  return updated
}

export const useCanvasStore = create(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      groups: [], // { id, name, nodeIds, color }
      undoStack: [],
      redoStack: [],
      // Active abort controllers for in-flight generations (keyed by node ID)
      _abortControllers: {},

      _snapshot: () => JSON.stringify({ nodes: get().nodes, edges: get().edges, selectedNodeId: get().selectedNodeId, selectedEdgeId: get().selectedEdgeId, groups: get().groups }),
      _pushUndo: () => {
        const { undoStack } = get()
        const snap = get()._snapshot()
        if (undoStack.length && undoStack[undoStack.length - 1] === snap) return
        set({ undoStack: [...undoStack.slice(-MAX_UNDO), snap], redoStack: [] })
      },

      undo: () => {
        const { undoStack, redoStack } = get()
        if (!undoStack.length) return
        const current = get()._snapshot()
        const restored = JSON.parse(undoStack[undoStack.length - 1])
        set({ nodes: restored.nodes, edges: restored.edges,
          undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, current],
          selectedNodeId: null })
      },

      redo: () => {
        const { redoStack, undoStack } = get()
        if (!redoStack.length) return
        const current = get()._snapshot()
        const restored = JSON.parse(redoStack[redoStack.length - 1])
        set({ nodes: restored.nodes, edges: restored.edges,
          redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, current],
          selectedNodeId: null })
      },

      onNodesChange: (changes) => {
        get()._pushUndo()
        set({ nodes: applyNodeChanges(changes, get().nodes) })
      },

      onEdgesChange: (changes) => {
        get()._pushUndo()
        set({ edges: applyEdgeChanges(changes, get().edges) })
      },

      onConnect: (connection) => {
        const { source, target } = connection
        if (source === target) return

        const sourceNode = get().nodes.find((n) => n.id === source)
        const targetNode = get().nodes.find((n) => n.id === target)

        // Use shared validation (type + handle level)
        if (!validateConnection(sourceNode, targetNode, connection.targetHandle)) return

        get()._pushUndo()

        const label = getEdgeLabel(sourceNode.type, targetNode.type)
        const newEdges = [...get().edges, {
          ...connection,
          id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'smoothstep', animated: true,
          label,
          labelStyle: { fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.85 },
          labelBgPadding: [4, 3],
          labelBgBorderRadius: 3,
          style: { stroke: 'var(--accent)', strokeWidth: 3, strokeLinecap: 'round' },
        }]

        // 🔗 Auto-sync data on connection
        let updatedNodes = syncNodeDownstream(source, get().nodes, newEdges)
        updatedNodes = syncNodeUpstream(target, updatedNodes, newEdges)

        set({ edges: newEdges, nodes: updatedNodes })
      },

      addNode: (type, position = { x: 250, y: 200 }) => {
        if (get().nodes.length >= MAX_NODES) return
        get()._pushUndo()
        const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        set({ nodes: [...get().nodes, { id, type, position, data: { ...nodeDefaults[type] } }] })
      },

      // Batch add: multiple nodes + edges in one undo step (for quick-start templates)
      // `items.nodes` = [{type, position?, data?}], `items.edges` = [{source: index, target: index}]
      batchAddNodes: (items) => {
        const s = get()
        const nodeItems = items.nodes || []
        // Guard: current + incoming must not exceed MAX_NODES
        if (s.nodes.length >= MAX_NODES || s.nodes.length + nodeItems.length > MAX_NODES) return
        if (!nodeItems.length) return
        get()._pushUndo()
        const ts = Date.now()
        const ids = nodeItems.map((_, i) => `n_${ts}_${i}_${Math.random().toString(36).slice(2, 5)}`)
        const newNodes = nodeItems.map((it, i) => ({
          id: ids[i],
          type: it.type,
          position: it.position || { x: 250, y: 200 + i * 100 },
          data: { ...(nodeDefaults[it.type] || {}), ...(it.data || {}) },
        }))
        const newEdges = (items.edges || []).map((e, i) => {
          const srcNode = newNodes.find(n => ids.indexOf(n.id) === e.source)
          const tgtNode = newNodes.find(n => ids.indexOf(n.id) === e.target)
          const label = srcNode && tgtNode ? getEdgeLabel(srcNode.type, tgtNode.type) : ''
          return {
            id: `e_${ts}_${i}_${Math.random().toString(36).slice(2, 5)}`,
            source: ids[e.source],
            target: ids[e.target],
            sourceHandle: e.sourceHandle || 'output',
            targetHandle: e.targetHandle || 'prompt',
            type: 'smoothstep', animated: true, label,
            labelStyle: { fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 },
            labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.85 },
            labelBgPadding: [4, 3], labelBgBorderRadius: 3,
            style: { stroke: 'var(--accent)', strokeWidth: 3, strokeLinecap: 'round' },
          }
        })
        set({ nodes: [...s.nodes, ...newNodes], edges: [...s.edges, ...newEdges] })
      },

      autoBuild: (sourceId, targetType, targetData = {}, addPreview = false) => {
        const s = get()
        const sourceNode = s.nodes.find((n) => n.id === sourceId)
        const addCount = addPreview ? 2 : 1
        if (!sourceNode || s.nodes.length >= MAX_NODES || s.nodes.length + addCount > MAX_NODES) return

        s._pushUndo()
        const baseX = sourceNode.position.x + 340
        const baseY = sourceNode.position.y - 60

        // Create target node
        const genId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const newNodes = [...s.nodes, {
          id: genId, type: targetType,
          position: { x: baseX, y: baseY },
          data: { ...targetData },
        }]

        // Create edge with data flow label
        const edgeLabel = getEdgeLabel(sourceNode.type, targetType)
        const newEdges = [...s.edges, {
          id: `e_${Date.now()}_a`, source: sourceId, sourceHandle: 'output',
          target: genId, targetHandle: 'prompt',
          type: 'smoothstep', animated: true, label: edgeLabel,
          labelStyle: { fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.85 },
          labelBgPadding: [4, 3], labelBgBorderRadius: 3,
          style: { stroke: 'var(--accent)', strokeWidth: 3, strokeLinecap: 'round' },
        }]

        // Optional preview node
        if (addPreview) {
          const previewId = `n_${Date.now() + 1}_${Math.random().toString(36).slice(2, 7)}`
          const previewEdgeLabel = targetType === 'videoGen' ? '🎬 视频' : '🖼️ 图片'
          newNodes.push({
            id: previewId, type: 'preview',
            position: { x: baseX + 340, y: baseY },
            data: { label: '预览输出', outputType: targetType === 'videoGen' ? 'video' : 'image' },
          })
          newEdges.push({
            id: `e_${Date.now()}_b`, source: genId, sourceHandle: 'output',
            target: previewId, targetHandle: 'input',
            type: 'smoothstep', animated: true, label: previewEdgeLabel,
            labelStyle: { fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 },
            labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.85 },
            labelBgPadding: [4, 3], labelBgBorderRadius: 3,
            style: { stroke: 'var(--accent)', strokeWidth: 3, strokeLinecap: 'round' },
          })
        }

        set({ nodes: newNodes, edges: newEdges })

        // D1: Auto-sync source data to new target + upstream pull
        const postNodes = syncNodeDownstream(sourceId, get().nodes, get().edges)
        const finalNodes = syncNodeUpstream(genId, postNodes, get().edges)
        if (finalNodes !== postNodes) set({ nodes: finalNodes })
      },

      duplicateNode: (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId)
        if (!node || get().nodes.length >= MAX_NODES) return
        get()._pushUndo()
        const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const pos = { x: node.position.x + 40, y: node.position.y + 40 }
        set({ nodes: [...get().nodes, {
          id, type: node.type, position: pos,
          data: { ...nodeDefaults[node.type], ...node.data, generatedImages: [], generatedVideo: null, status: 'idle', response: '' },
        }]})
      },

      updateNodeData: (nodeId, data, { syncDownstream = true } = {}) => {
        // Push undo for label changes (renaming is a user action worth undoing)
        if (data.label !== undefined) get()._pushUndo()
        let updated = get().nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)
        if (syncDownstream) {
          updated = syncNodeDownstream(nodeId, updated, get().edges)
          updated = syncNodeUpstream(nodeId, updated, get().edges)
        }
        set({ nodes: updated })
      },

      deleteNode: (nodeId) => {
        // Abort any in-flight generation for this node
        get().abortGeneration(nodeId)
        get()._pushUndo()
        set({ nodes: get().nodes.filter((n) => n.id !== nodeId),
          edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId })
      },

      // AbortController management for in-flight generations
      registerAbort: (nodeId, controller) => {
        // Abort any previous in-flight generation for this node before registering new one
        const prev = get()._abortControllers[nodeId]
        if (prev) { try { prev.abort() } catch {} }
        set({ _abortControllers: { ...get()._abortControllers, [nodeId]: controller } })
      },
      unregisterAbort: (nodeId) => {
        const next = { ...get()._abortControllers }
        delete next[nodeId]
        set({ _abortControllers: next })
      },
      abortGeneration: (nodeId) => {
        const ctrl = get()._abortControllers[nodeId]
        if (ctrl) {
          ctrl.abort()
          const next = { ...get()._abortControllers }
          delete next[nodeId]
          set({ _abortControllers: next })
        }
        // Reset node status to idle and sync downstream
        let updated = get().nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, status: 'idle', errorMessage: '' } } : n)
        updated = syncNodeDownstream(nodeId, updated, get().edges)
        set({ nodes: updated })
      },

      deleteEdge: (edgeId) => {
        get()._pushUndo()
        set({ edges: get().edges.filter((e) => e.id !== edgeId), selectedEdgeId: null })
      },

      selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),
      deselectEdge: () => set({ selectedEdgeId: null }),

      // Insert a node between two connected nodes (edge interaction)
      insertNodeBetween: (edgeId, nodeType, nodeData = {}) => {
        const s = get()
        const edge = s.edges.find((e) => e.id === edgeId)
        if (!edge) return
        const srcNode = s.nodes.find((n) => n.id === edge.source)
        const tgtNode = s.nodes.find((n) => n.id === edge.target)
        if (!srcNode || !tgtNode) return
        if (s.nodes.length >= MAX_NODES) return

        s._pushUndo()
        const midX = (srcNode.position.x + tgtNode.position.x) / 2
        const midY = (srcNode.position.y + tgtNode.position.y) / 2
        const newId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

        // Create new node in middle
        const newNode = {
          id: newId, type: nodeType,
          position: { x: midX - 130, y: midY - 60 },
          data: { ...(nodeDefaults[nodeType] || {}), ...nodeData },
        }

        // Auto-fill prompt from upstream
        if (srcNode.type === 'textPrompt' && srcNode.data.prompt) {
          newNode.data.prompt = srcNode.data.prompt
        }

        // Remove old edge, create two new edges
        const newNodes = [...s.nodes, newNode]
        const label1 = getEdgeLabel(srcNode.type, nodeType)
        const label2 = getEdgeLabel(nodeType, tgtNode.type)
        const newEdges = s.edges
          .filter((e) => e.id !== edgeId)
          .concat([
            {
              id: `e_${Date.now()}_a`, source: srcNode.id, target: newId,
              sourceHandle: HANDLE_IDS.source, targetHandle: HANDLE_IDS.target.prompt,
              type: 'smoothstep', animated: true, label: label1,
              labelStyle: { fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 },
              labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.85 },
              labelBgPadding: [4, 3], labelBgBorderRadius: 3,
              style: { stroke: 'var(--accent)', strokeWidth: 3, strokeLinecap: 'round' },
            },
            {
              id: `e_${Date.now()}_b`, source: newId, target: tgtNode.id,
              sourceHandle: HANDLE_IDS.source, targetHandle: edge.targetHandle || HANDLE_IDS.target.input,
              type: 'smoothstep', animated: true, label: label2,
              labelStyle: { fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 },
              labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.85 },
              labelBgPadding: [4, 3], labelBgBorderRadius: 3,
              style: { stroke: 'var(--accent)', strokeWidth: 3, strokeLinecap: 'round' },
            },
          ])

        set({ nodes: newNodes, edges: newEdges, selectedEdgeId: null })

        // Sync data flow through the new node
        const postNodes = syncNodeDownstream(srcNode.id, get().nodes, get().edges)
        const finalNodes = syncNodeUpstream(newId, postNodes, get().edges)
        if (finalNodes !== postNodes) set({ nodes: finalNodes })
      },

      // Groups
      createGroup: (name, nodeIds, color) => {
        get()._pushUndo()
        const id = `g_${Date.now()}`
        set({ groups: [...get().groups, { id, name: name || '节点组', nodeIds, color: color || '#6b7280' }] })
        return id
      },
      updateGroup: (groupId, updates) => {
        get()._pushUndo()
        set({ groups: get().groups.map((g) => g.id === groupId ? { ...g, ...updates } : g) })
      },
      deleteGroup: (groupId) => {
        get()._pushUndo()
        set({ groups: get().groups.filter((g) => g.id !== groupId) })
      },

      selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
      deselectNode: () => set({ selectedNodeId: null }),

      clearCanvas: () => {
        if (!get().nodes.length) return
        get()._pushUndo()
        set({ nodes: [], edges: [], selectedNodeId: null })
      },

      autoLayout: () => {
        if (!get().nodes.length) return
        get()._pushUndo()
        const cols = 3, sx = 320, sy = 280
        set({ nodes: get().nodes.map((n, i) => ({
          ...n, position: { x: 80 + (i % cols) * sx, y: 80 + Math.floor(i / cols) * sy },
        }))})
      },

      exportCanvas: () => ({
        version: 2,
        nodes: get().nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: get().edges.map(({ id, source, target, sourceHandle, targetHandle }) =>
          ({ id, source, target, sourceHandle, targetHandle })),
        groups: get().groups,
      }),

      importCanvas: (state) => {
        if (!state?.nodes || !Array.isArray(state.nodes)) {
          console.warn('[Canvas] importCanvas: invalid nodes data, skipping')
          return
        }
        get()._pushUndo()
        set({
          nodes: state.nodes.slice(0, MAX_NODES).map((n) => {
            if (!n || !n.id || !n.type) return null
            return { ...n, data: { ...(nodeDefaults[n.type] || {}), ...(n.data || {}) } }
          }).filter(Boolean),
          edges: (state.edges || []).map((e) => ({
            ...e, type: e.type || 'smoothstep', animated: true,
            style: e.style || { stroke: 'var(--accent)', strokeWidth: 3, strokeLinecap: 'round' },
          })),
          groups: state.groups || [],
          selectedNodeId: null, selectedEdgeId: null,
        })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges, groups: state.groups }),
      version: 1,
      // localStorage quota protection
      storage: {
        getItem: (name) => {
          try { return JSON.parse(localStorage.getItem(name) || 'null') }
          catch {
            console.warn('[Canvas] Corrupted localStorage data detected, resetting canvas state')
            return null
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value))
          } catch (e) {
            if (e.name === 'QuotaExceededError') {
              console.warn('[Canvas] localStorage full, attempting cleanup...')
              try { localStorage.removeItem('director_studio_messages') } catch {}
              try {
                localStorage.setItem(name, JSON.stringify(value))
              } catch {
                console.error('[Canvas] Failed to save — storage full')
              }
            }
          }
        },
        removeItem: (name) => { try { localStorage.removeItem(name) } catch {} },
      },
      onRehydrateStorage: () => (state) => {
        // Ensure runtime-only fields are initialized
        if (state && !state._abortControllers) state._abortControllers = {}
        // Validate stored state on load
        if (state && !Array.isArray(state.nodes)) {
          state.nodes = []
          state.edges = []
        }
      },
    }
  )
)
