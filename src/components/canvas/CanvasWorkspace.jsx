import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore } from './utils/canvasStore'
import { TextPromptNode } from './nodes/TextPromptNode'
import { ImageGenNode } from './nodes/ImageGenNode'
import { VideoGenNode } from './nodes/VideoGenNode'
import { ReferenceNode } from './nodes/ReferenceNode'
import { PreviewNode } from './nodes/PreviewNode'
import { AgentNode } from './nodes/AgentNode'
import { PixelleVideoNode } from './nodes/PixelleVideoNode'
import { CanvasToolbar } from './CanvasToolbar'
import { NodeConfigPanel } from './NodeConfigPanel'
import { CanvasWelcome } from './CanvasWelcome'
import { validConnections } from './utils/nodeDefaults'

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
  videoGen: VideoGenNode, reference: ReferenceNode,
  preview: PreviewNode, agent: AgentNode,
  pixelleVideo: PixelleVideoNode,
}

const NODE_COLORS = {
  textPrompt: 'var(--accent-tts)', imageGen: 'var(--accent-music)',
  videoGen: 'var(--accent-sfx)', reference: 'var(--accent-clone)',
  preview: 'var(--brand)', agent: 'var(--brand)', pixelleVideo: '#8b5cf6',
}

export default function CanvasWorkspace() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

function CanvasInner() {
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    selectedNodeId, deselectNode, deleteEdge, deleteNode,
    undo, redo, duplicateNode, addNode, selectNode,
  } = useCanvasStore()
  const [zoom, setZoom] = useState(1)
  const [contextMenu, setContextMenu] = useState(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const wrapperRef = useRef(null)

  // Compute connected nodes for selection highlighting
  const connectedNodeIds = useMemo(() =>
    selectedNodeId ? getConnectedNodeIds(selectedNodeId, edges) : new Set(),
    [selectedNodeId, edges])

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
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedNodeId) {
        s.deleteNode(s.selectedNodeId)
      }
      if (e.key === 'Escape') { s.deselectNode(); setContextMenu(null) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
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
        // Create a ReferenceNode with the image URL pre-loaded
        addNode('reference', position)
        // Find the newly created node and update its data
        const s = useCanvasStore.getState()
        const newNode = s.nodes[s.nodes.length - 1]
        if (newNode) {
          s.updateNodeData(newNode.id, {
            label: parsed.name || '图片素材',
            mediaType: 'image',
            mediaData: parsed.url,
            fileName: parsed.name || 'Generated Image',
          }, { syncDownstream: true })
        }
        return
      } catch { /* fall through to node type handling */ }
    }

    // Node type drop (from toolbar)
    const type = e.dataTransfer.getData('application/reactflow-type')
    if (!type) return
    addNode(type, position)
  }, [screenToFlowPosition, addNode])

  // Right-click context menu
  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault()
    selectNode(node.id)
    // Position relative to viewport
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
  }, [selectNode])

  const onPaneClick = useCallback(() => {
    deselectNode()
    setContextMenu(null)
  }, [deselectNode])

  const onEdgeClick = useCallback((_, edge) => {
    deleteEdge(edge.id)
  }, [deleteEdge])

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
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        onNodeClick={(_, node) => useCanvasStore.getState().selectNode(node.id)}
        onNodeContextMenu={onNodeContextMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'smoothstep', animated: true,
          style: { stroke: 'var(--accent)', strokeWidth: 2 },
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
          const allowed = validConnections[src.type]
          return !!allowed && !!allowed[tgt.type]
        }}
      >
        <Background gap={24} size={1} color="var(--border)" />
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

      {/* Right-click context menu */}
      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 50,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 4, minWidth: 140,
          boxShadow: 'var(--shadow-panel)',
        }} onClick={(e) => e.stopPropagation()}>
          <MenuItem onClick={() => { duplicateNode(contextMenu.nodeId); setContextMenu(null) }}
            label="📋 复制节点" shortcut="Ctrl+D" />
          <MenuItem onClick={() => { deleteNode(contextMenu.nodeId); setContextMenu(null) }}
            label="🗑️ 删除节点" shortcut="Del" danger />
        </div>
      )}

      <CanvasToolbar undo={undo} redo={redo} fitView={fitView} />
      <NodeConfigPanel />
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
