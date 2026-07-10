import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useReactFlow, applyNodeChanges, applyEdgeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore } from './utils/canvasStore'
import { TextPromptNode } from './nodes/TextPromptNode'
import { ImageGenNode } from './nodes/ImageGenNode'
import { VideoGenNode } from './nodes/VideoGenNode'
import { MediaGenNode } from './nodes/MediaGenNode'
import { ReferenceNode } from './nodes/ReferenceNode'
import { PreviewNode } from './nodes/PreviewNode'
import { AgentNode } from './nodes/AgentNode'
import { PixelleVideoNode } from './nodes/PixelleVideoNode'
import { CanvasToolbar } from './CanvasToolbar'
import { NodeConfigPanel } from './NodeConfigPanel'
import { CanvasWelcome } from './CanvasWelcome'
import { CanvasInputBar } from './CanvasInputBar'
import { ProjectBiblePanel } from './ProjectBiblePanel'
import { validateConnection } from './utils/canvasStore'
import { animateMenuEnter } from '../../lib/canvasAnimations'

// Compute connected node IDs for highlighting
function getConnectedNodeIds(nodeId, edges) {
  const ids = new Set([nodeId])
  for (const e of edges) {
    if (e.source === nodeId) ids.add(e.target)
    if (e.target === nodeId) ids.add(e.source)
  }
  return ids
}

const nodeTypes = {
  textPrompt: TextPromptNode, imageGen: ImageGenNode,
  videoGen: VideoGenNode, mediaGen: MediaGenNode,
  reference: ReferenceNode, preview: PreviewNode,
  agent: AgentNode, pixelleVideo: PixelleVideoNode,
}

const NODE_COLORS = {
  textPrompt: 'var(--accent-tts)', imageGen: 'var(--accent-music)',
  videoGen: 'var(--accent-sfx)', mediaGen: '#8b5cf6',
  reference: 'var(--accent-clone)', preview: 'var(--brand)',
  agent: 'var(--brand)', pixelleVideo: '#8b5cf6',
}

// Node types for quick-add context menus
const QUICK_ADD_NODES = [
  { type: 'textPrompt', label: '📝 文本提示词' },
  { type: 'mediaGen', label: '🎨 媒体生成' },
  { type: 'reference', label: '🖼️ 参考素材' },
  { type: 'agent', label: '🧠 AI 智能体' },
  { type: 'preview', label: '👁️ 预览输出' },
]

// Node type labels for picker menus
const TYPE_LABELS = {
  textPrompt: '📝 文本提示词', imageGen: '🎨 图片生成', videoGen: '🎬 视频生成',
  mediaGen: '🎨 媒体生成', reference: '🖼️ 参考素材', preview: '👁️ 预览输出',
  agent: '🧠 AI智能体', pixelleVideo: '🎞️ 短视频',
}

// Edge insert node options
const EDGE_INSERT_NODES = [
  { type: 'textPrompt', label: '📝 文本' },
  { type: 'mediaGen', label: '🎨 媒体生成' },
  { type: 'agent', label: '🧠 智能体' },
]

export default function CanvasWorkspace() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

function CanvasInner() {
  const {
    nodes, edges, groups, onNodesChange, onEdgesChange, onConnect,
    selectedNodeId, selectedEdgeId, deselectNode, deleteEdge, deleteNode,
    undo, redo, duplicateNode, addNode, selectNode,
    insertNodeBetween, createGroup, deleteGroup, updateNodeData,
  } = useCanvasStore()
  const [zoom, setZoom] = useState(1)
  const [contextMenu, setContextMenu] = useState(null) // { type, x, y, nodeId/edgeId }
  const [renameModal, setRenameModal] = useState(null) // { nodeId, name }
  const { screenToFlowPosition, fitView } = useReactFlow()
  const wrapperRef = useRef(null)

  // Compute connected nodes for selection highlighting
  const connectedNodeIds = useMemo(() =>
    selectedNodeId ? getConnectedNodeIds(selectedNodeId, edges) : new Set(),
    [selectedNodeId, edges])

  // Animate context menu + rename modal on appear
  const menuRef = useRef(null)
  useEffect(() => {
    if (contextMenu && menuRef.current) animateMenuEnter(menuRef.current)
  }, [contextMenu])
  useEffect(() => {
    if (renameModal) {
      const el = document.querySelector('.rename-modal')
      if (el) animateMenuEnter(el)
    }
  }, [renameModal])

  // Close context menu on any click
  const closeMenu = useCallback(() => setContextMenu(null), [])

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      const s = useCanvasStore.getState()
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); s.undo() }
      if ((e.ctrlKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) { e.preventDefault(); s.redo() }
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); if (s.selectedNodeId) s.duplicateNode(s.selectedNodeId) }
      if (e.ctrlKey && e.key === 'g' && s.selectedNodeId) { e.preventDefault(); handleGroupSelection(s) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedNodeId) {
        s.deleteNode(s.selectedNodeId)
      }
      if (e.key === 'Escape') { s.deselectNode(); s.deselectEdge(); setContextMenu(null) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  // Smart handle click → show downstream node type picker
  const onConnectStart = useCallback((_, { nodeId, handleId, handleType }) => {
    if (handleType !== 'source') return
    const s = useCanvasStore.getState()
    const srcNode = s.nodes.find((n) => n.id === nodeId)
    if (!srcNode) return
    // Get valid downstream types for this source node
    const allowed = validConnections[srcNode.type]
    if (!allowed) return
    const targetTypes = Object.keys(allowed)
    if (!targetTypes.length) return
    // Show picker near the handle position
    setContextMenu({
      type: 'handlePicker',
      x: srcNode.position.x + 150,
      y: srcNode.position.y + 50,
      sourceNodeId: nodeId,
      sourceHandleId: handleId,
      targetTypes,
    })
  }, [])

  // Drag-from-toolbar + drag-image-to-node handlers
  const onDragOver = useCallback((e) => {
    e.preventDefault()
    const hasType = e.dataTransfer.types.includes('application/reactflow-type')
    const hasImage = e.dataTransfer.types.includes('application/canvas-image')
    e.dataTransfer.dropEffect = hasType ? 'move' : hasImage ? 'copy' : 'move'
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })

    // Check for image drop (create ReferenceNode)
    const imageData = e.dataTransfer.getData('application/canvas-image')
    if (imageData) {
      try {
        const parsed = JSON.parse(imageData)
        addNode('reference', position)
        const s = useCanvasStore.getState()
        const newNode = s.nodes[s.nodes.length - 1]
        if (newNode) {
          s.updateNodeData(newNode.id, {
            label: parsed.name || '图片素材', mediaType: 'image',
            mediaData: parsed.url, fileName: parsed.name || 'Generated Image',
          }, { syncDownstream: true })
        }
        return
      } catch { /* fall through */ }
    }

    const type = e.dataTransfer.getData('application/reactflow-type')
    if (!type) return
    addNode(type, position)
  }, [screenToFlowPosition, addNode])

  // --- Rename node on double-click ---
  const onNodeDoubleClick = useCallback((_, node) => {
    setRenameModal({ nodeId: node.id, name: node.data.label || node.type || '' })
  }, [])

  const handleRename = useCallback(() => {
    if (!renameModal) return
    useCanvasStore.getState().updateNodeData(renameModal.nodeId, { label: renameModal.name })
    setRenameModal(null)
  }, [renameModal])

  // --- Group selected nodes ---
  const handleGroupSelection = useCallback((store) => {
    // Use store's selectedNodeId + find its connected nodes for grouping
    const selId = store.selectedNodeId
    if (!selId) return
    const node = store.nodes.find((n) => n.id === selId)
    if (!node) return
    // Collect directly connected nodes
    const ids = new Set([selId])
    for (const e of store.edges) {
      if (e.source === selId) ids.add(e.target)
      if (e.target === selId) ids.add(e.source)
    }
    const nodeIds = [...ids]
    if (nodeIds.length < 2) return
    const name = prompt('输入节点组名称:', '节点组')
    if (!name) return
    const colors = ['#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#84cc16', '#ef4444']
    store.createGroup(name, nodeIds, colors[Math.floor(Math.random() * colors.length)])
  }, [])

  // --- Right-click on node ---
  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault()
    selectNode(node.id)
    setContextMenu({ type: 'node', x: e.clientX, y: e.clientY, nodeId: node.id })
  }, [selectNode])

  // --- Right-click on canvas background → add nodes ---
  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault()
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setContextMenu({ type: 'pane', x: e.clientX, y: e.clientY, position: pos })
  }, [screenToFlowPosition])

  // --- Click on pane → deselect ---
  const onPaneClick = useCallback(() => {
    deselectNode()
    useCanvasStore.getState().deselectEdge()
    setContextMenu(null)
  }, [deselectNode])

  // --- Click on edge → select (not delete) ---
  const onEdgeClick = useCallback((e, edge) => {
    useCanvasStore.getState().selectEdge(edge.id)
  }, [])

  // --- Right-click on edge → context menu ---
  const handleEdgeDelete = useCallback((edgeId) => {
    deleteEdge(edgeId)
    setContextMenu(null)
  }, [deleteEdge])

  // Handle picker: auto-create node + edge from source handle
  const handlePickerCreate = useCallback((sourceNodeId, targetType) => {
    const s = useCanvasStore.getState()
    const srcNode = s.nodes.find((n) => n.id === sourceNodeId)
    if (!srcNode) return
    const pos = { x: srcNode.position.x + 360, y: srcNode.position.y - 60 }
    s.addNode(targetType, pos)
    const newNode = s.nodes[s.nodes.length - 1]
    if (newNode) {
      // Auto-fill prompt from upstream (deep read)
      if (srcNode.data?.prompt && !newNode.data.prompt) {
        s.updateNodeData(newNode.id, { prompt: srcNode.data.prompt }, { syncDownstream: false })
      }
      if (srcNode.data?.response && !newNode.data.prompt) {
        s.updateNodeData(newNode.id, { prompt: srcNode.data.response }, { syncDownstream: false })
      }
      // Create edge — data will sync on next render cycle
      useCanvasStore.setState({
        edges: [...s.edges, {
          id: `e_${Date.now()}_picker`, source: sourceNodeId, target: newNode.id,
          sourceHandle: 'output', targetHandle: targetType === 'preview' ? 'input' : 'prompt',
          type: 'smoothstep', animated: true,
          style: { stroke: 'var(--accent)', strokeWidth: 3, strokeLinecap: 'round' },
        }]
      })
    }
    setContextMenu(null)
  }, [])

  const handleEdgeInsert = useCallback((edgeId, nodeType) => {
    insertNodeBetween(edgeId, nodeType)
    setContextMenu(null)
  }, [insertNodeBetween])

  // --- Edge context menu trigger ---
  useEffect(() => {
    if (!selectedEdgeId) {
      // Clear edge menu when edge is deselected
      setContextMenu(null)
      return
    }
    const edge = useCanvasStore.getState().edges.find((e) => e.id === selectedEdgeId)
    if (!edge) {
      setContextMenu(null)
      return
    }
    const src = useCanvasStore.getState().nodes.find((n) => n.id === edge.source)
    const tgt = useCanvasStore.getState().nodes.find((n) => n.id === edge.target)
    if (src && tgt) {
      setContextMenu({ type: 'edge', edgeId: selectedEdgeId,
        x: (src.position.x + tgt.position.x) / 2 + 80,
        y: (src.position.y + tgt.position.y) / 2 + 100 })
    }
  }, [selectedEdgeId])

  // Highlight connected nodes / dim non-connected when a node is selected
  const displayNodes = useMemo(() => {
    if (!selectedNodeId || connectedNodeIds.size <= 1) return nodes
    return nodes.map(n => ({
      ...n,
      className: connectedNodeIds.has(n.id) ? 'node-highlighted' : 'node-dimmed',
    }))
  }, [nodes, selectedNodeId, connectedNodeIds])

  return (
    <div className="w-full h-full relative" ref={wrapperRef} onClick={closeMenu} style={{ outline: 'none' }}>
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onEdgeClick={onEdgeClick}
        onNodeClick={(_, node) => useCanvasStore.getState().selectNode(node.id)}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'smoothstep', animated: true,
          style: { stroke: 'var(--accent, #0EA5E9)', strokeWidth: 3, strokeLinecap: 'round' },
        }}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--bg-root)' }}
        onViewportChange={(vp) => setZoom(Math.round(vp?.zoom * 100) / 100)}
        // Connection validation visual
        isValidConnection={(connection) => {
          const s = useCanvasStore.getState()
          const src = s.nodes.find((n) => n.id === connection.source)
          const tgt = s.nodes.find((n) => n.id === connection.target)
          if (!src || !tgt || src.id === tgt.id) return false
          return validateConnection(src, tgt, connection.targetHandle)
        }}
      >
        <Background gap={24} size={2} color="var(--border)" />
        <Background gap={96} size={2} color="var(--border)" />
        <Controls style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
        }} />
        <MiniMap
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}
          nodeColor={(n) => NODE_COLORS[n.type] || 'var(--accent)'}
          maskColor="rgba(0,0,0,0.4)" pannable zoomable
        />
      </ReactFlow>

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 10,
        fontSize: 11, color: 'var(--text-muted)',
        background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)', borderRadius: 6, padding: '4px 10px',
      }}>{Math.round(zoom * 100)}%</div>

      {/* --- Right-click Context Menu --- */}
      {contextMenu && (
        <div className="canvas-context-menu" ref={menuRef} style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 50,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 4, minWidth: 160,
          boxShadow: 'var(--shadow-panel)',
        }} onClick={(e) => e.stopPropagation()}>
          {/* Node menu */}
          {contextMenu.type === 'node' && (
            <>
              <MenuItem onClick={() => {
                setRenameModal({ nodeId: contextMenu.nodeId,
                  name: useCanvasStore.getState().nodes.find((n) => n.id === contextMenu.nodeId)?.data?.label || '' })
                setContextMenu(null)
              }} label="✏️ 重命名" />
              <MenuItem onClick={() => { duplicateNode(contextMenu.nodeId); setContextMenu(null) }}
                label="📋 复制" shortcut="Ctrl+D" />
              <div className="menu-divider" />
              <MenuItem onClick={() => { deleteNode(contextMenu.nodeId); setContextMenu(null) }}
                label="🗑️ 删除" shortcut="Del" danger />
            </>
          )}

          {/* Pane (canvas background) menu */}
          {contextMenu.type === 'pane' && (
            <>
              <div className="menu-label">➕ 快速添加</div>
              {QUICK_ADD_NODES.map((n) => (
                <MenuItem key={n.type} onClick={() => {
                  addNode(n.type, contextMenu.position)
                  setContextMenu(null)
                }} label={n.label} />
              ))}
            </>
          )}

          {/* Edge menu */}
          {contextMenu.type === 'edge' && (
            <>
              <div className="menu-label">🔗 连线操作</div>
              <div className="menu-sub-label">插入节点</div>
              {EDGE_INSERT_NODES.map((n) => (
                <MenuItem key={n.type} onClick={() => handleEdgeInsert(contextMenu.edgeId, n.type)}
                  label={n.label} />
              ))}
              <div className="menu-divider" />
              <MenuItem onClick={() => handleEdgeDelete(contextMenu.edgeId)}
                label="✂️ 删除连线" danger />
            </>
          )}

          {/* Handle picker: show valid downstream node types */}
          {contextMenu.type === 'handlePicker' && (
            <>
              <div className="menu-label">➕ 创建下游节点</div>
              {contextMenu.targetTypes.map((t) => (
                <MenuItem key={t} onClick={() => handlePickerCreate(contextMenu.sourceNodeId, t)}
                  label={TYPE_LABELS[t] || t} />
              ))}
            </>
          )}
        </div>
      )}

      {/* --- Rename Modal --- */}
      {renameModal && (
        <>
          <div className="rename-overlay" onClick={() => setRenameModal(null)} />
          <div className="rename-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              ✏️ 重命名节点
            </div>
            <input
              value={renameModal.name}
              onChange={(e) => setRenameModal({ ...renameModal, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameModal(null) }}
              className="config-input"
              autoFocus
              placeholder="输入节点名称..."
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRenameModal(null)}
                style={{ padding: '5px 12px', fontSize: 11, borderRadius: 5, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>取消</button>
              <button onClick={handleRename}
                style={{ padding: '5px 12px', fontSize: 11, borderRadius: 5, border: 'none',
                  background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>确定</button>
            </div>
          </div>
        </>
      )}

      <CanvasToolbar undo={undo} redo={redo} fitView={fitView} />
      <ProjectBiblePanel />
      <NodeConfigPanel />
      <CanvasInputBar />
      {nodes.length === 0 && <CanvasWelcome />}
    </div>
  )
}

function MenuItem({ onClick, label, shortcut, danger }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', justifyContent: 'space-between', width: '100%',
      padding: '7px 10px', fontSize: 12, border: 'none', borderRadius: 5,
      background: 'transparent', color: danger ? '#ef4444' : 'var(--text)',
      cursor: 'pointer',
    }}
      onMouseEnter={(e) => e.target.style.background = danger ? 'rgba(239,68,68,0.08)' : 'var(--bg-root)'}
      onMouseLeave={(e) => e.target.style.background = 'transparent'}
    >
      <span>{label}</span>
      {shortcut && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{shortcut}</span>}
    </button>
  )
}
