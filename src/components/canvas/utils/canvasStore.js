import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { nodeDefaults, validConnections } from './nodeDefaults'

const STORAGE_KEY = 'director_studio_canvas'
const MAX_UNDO = 50
const MAX_NODES = 100

export const useCanvasStore = create(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      undoStack: [],
      redoStack: [],

      _snapshot: () => JSON.stringify({ nodes: get().nodes, edges: get().edges }),
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

        // Validate connection: sourceType -> targetType
        const sourceNode = get().nodes.find((n) => n.id === source)
        const targetNode = get().nodes.find((n) => n.id === target)
        if (sourceNode && targetNode) {
          const allowed = validConnections[sourceNode.type]
          if (!allowed || !allowed[targetNode.type]) {
            return // Invalid connection — silently reject
          }
        }

        get()._pushUndo()
        set({ edges: [...get().edges, {
          ...connection,
          id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'smoothstep', animated: true,
          style: { stroke: 'var(--accent)', strokeWidth: 2 },
        }]})
      },

      addNode: (type, position = { x: 250, y: 200 }) => {
        if (get().nodes.length >= MAX_NODES) return
        get()._pushUndo()
        const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        set({ nodes: [...get().nodes, { id, type, position, data: { ...nodeDefaults[type] } }] })
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

      updateNodeData: (nodeId, data) =>
        set({ nodes: get().nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n) }),

      deleteNode: (nodeId) => {
        get()._pushUndo()
        set({ nodes: get().nodes.filter((n) => n.id !== nodeId),
          edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId })
      },

      deleteEdge: (edgeId) => {
        get()._pushUndo()
        set({ edges: get().edges.filter((e) => e.id !== edgeId) })
      },

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
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
        version: 1,
        nodes: get().nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: get().edges.map(({ id, source, target, sourceHandle, targetHandle }) =>
          ({ id, source, target, sourceHandle, targetHandle })),
      }),

      importCanvas: (state) => {
        if (!state?.nodes) return
        get()._pushUndo()
        set({
          nodes: state.nodes.slice(0, MAX_NODES).map((n) => ({
            ...n, data: { ...(nodeDefaults[n.type] || {}), ...n.data },
          })),
          edges: (state.edges || []).map((e) => ({
            ...e, type: e.type || 'smoothstep', animated: true,
            style: e.style || { stroke: 'var(--accent)', strokeWidth: 2 },
          })),
          selectedNodeId: null,
        })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
      version: 1,
      onRehydrateStorage: () => (state) => {
        // Validate stored state on load
        if (state && !Array.isArray(state.nodes)) {
          state.nodes = []
          state.edges = []
        }
      },
    }
  )
)
