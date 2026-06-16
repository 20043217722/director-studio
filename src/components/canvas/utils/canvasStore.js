import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { nodeDefaults } from './nodeDefaults'

const STORAGE_KEY = 'director_studio_canvas'
const MAX_UNDO = 50

export const useCanvasStore = create(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      undoStack: [],
      redoStack: [],

      _pushUndo: () => {
        const { nodes, edges, undoStack } = get()
        const snapshot = JSON.stringify({ nodes, edges })
        if (undoStack.length && undoStack[undoStack.length - 1] === snapshot) return
        set({ undoStack: [...undoStack.slice(-MAX_UNDO), snapshot], redoStack: [] })
      },

      undo: () => {
        const { undoStack, redoStack, nodes, edges } = get()
        if (!undoStack.length) return
        const current = JSON.stringify({ nodes, edges })
        const prev = undoStack[undoStack.length - 1]
        const restored = JSON.parse(prev)
        set({
          nodes: restored.nodes, edges: restored.edges,
          undoStack: undoStack.slice(0, -1),
          redoStack: [...redoStack, current],
          selectedNodeId: null,
        })
      },

      redo: () => {
        const { redoStack, undoStack, nodes, edges } = get()
        if (!redoStack.length) return
        const current = JSON.stringify({ nodes, edges })
        const next = redoStack[redoStack.length - 1]
        const restored = JSON.parse(next)
        set({
          nodes: restored.nodes, edges: restored.edges,
          redoStack: redoStack.slice(0, -1),
          undoStack: [...undoStack, current],
          selectedNodeId: null,
        })
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
        get()._pushUndo()
        set({
          edges: [
            ...get().edges,
            {
              ...connection,
              id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: 'smoothstep',
              animated: true,
              style: { stroke: 'var(--accent)', strokeWidth: 2 },
            },
          ],
        })
      },

      addNode: (type, position = { x: 250, y: 200 }) => {
        get()._pushUndo()
        const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const defaults = nodeDefaults[type] || nodeDefaults.textPrompt
        set({
          nodes: [...get().nodes, { id, type, position, data: { ...defaults } }],
        })
      },

      updateNodeData: (nodeId, data) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
          ),
        }),

      deleteNode: (nodeId) => {
        get()._pushUndo()
        set({
          nodes: get().nodes.filter((n) => n.id !== nodeId),
          edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
        })
      },

      deleteEdge: (edgeId) => {
        get()._pushUndo()
        set({ edges: get().edges.filter((e) => e.id !== edgeId) })
      },

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
      deselectNode: () => set({ selectedNodeId: null }),

      clearCanvas: () => {
        if (get().nodes.length === 0) return
        get()._pushUndo()
        set({ nodes: [], edges: [], selectedNodeId: null })
      },

      autoLayout: () => {
        if (get().nodes.length === 0) return
        get()._pushUndo()
        const cols = 3
        const spacing = { x: 320, y: 280 }
        const updated = get().nodes.map((n, i) => ({
          ...n,
          position: {
            x: 80 + (i % cols) * spacing.x,
            y: 80 + Math.floor(i / cols) * spacing.y,
          },
        }))
        set({ nodes: updated })
      },

      exportCanvas: () => ({
        version: 1,
        nodes: get().nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: get().edges.map(({ id, source, target, sourceHandle, targetHandle }) =>
          ({ id, source, target, sourceHandle, targetHandle })),
      }),

      importCanvas: (state) => {
        if (!state || !state.nodes) return
        get()._pushUndo()
        set({
          nodes: state.nodes.map((n) => ({
            ...n,
            data: { ...(nodeDefaults[n.type] || {}), ...n.data },
          })),
          edges: (state.edges || []).map((e) => ({
            ...e,
            type: e.type || 'smoothstep',
            animated: true,
            style: e.style || { stroke: 'var(--accent)', strokeWidth: 2 },
          })),
          selectedNodeId: null,
        })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
    }
  )
)
