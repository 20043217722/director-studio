import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore, validateConnection } from './utils/canvasStore'
import { TextPromptNode } from './nodes/TextPromptNode'
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

function getConnectedNodeIds(nodeId, edges) {
  const ids = new Set([nodeId])
  for (const e of edges) { if (e.source === nodeId) ids.add(e.target); if (e.target === nodeId) ids.add(e.source) }
  return ids
}

const nodeTypes = {
  textPrompt: TextPromptNode,
  mediaGen: MediaGenNode,
  imageGen: MediaGenNode,
  videoGen: MediaGenNode,
  reference: ReferenceNode,
  preview: PreviewNode,
  agent: AgentNode,
  pixelleVideo: PixelleVideoNode,
}

const QUICK_ADD_NODES = [
  { type: 'textPrompt', label: 'Text Prompt' },
  { type: 'mediaGen', label: 'Media Gen' },
  { type: 'reference', label: 'Reference' },
  { type: 'agent', label: 'AI Agent' },
  { type: 'preview', label: 'Preview' },
]

const TYPE_LABELS = {
  textPrompt: 'Text Prompt', mediaGen: 'Media Gen',
  reference: 'Reference', preview: 'Preview', agent: 'AI Agent', pixelleVideo: 'Short Video',
}

export default function CanvasWorkspace() {
  return <ReactFlowProvider><CanvasInner /></ReactFlowProvider>
}

function CanvasInner() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, selectedNodeId, selectedEdgeId,
    deselectNode, deleteEdge, deleteNode, undo, redo, duplicateNode, addNode, selectNode,
    insertNodeBetween, createGroup, deleteGroup, updateNodeData } = useCanvasStore()
  const [zoom, setZoom] = useState(1)
  const [contextMenu, setContextMenu] = useState(null)
  const [renameModal, setRenameModal] = useState(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const wrapperRef = useRef(null)

  const connectedNodeIds = useMemo(() =>
    selectedNodeId ? getConnectedNodeIds(selectedNodeId, edges) : new Set(), [selectedNodeId, edges])

  const closeMenu = useCallback(() => setContextMenu(null), [])

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      const s = useCanvasStore.getState()
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); s.undo() }
      if ((e.ctrlKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) { e.preventDefault(); s.redo() }
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); if (s.selectedNodeId) s.duplicateNode(s.selectedNodeId) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedNodeId) { s.deleteNode(s.selectedNodeId) }
      if (e.key === 'Escape') { s.deselectNode(); s.deselectEdge(); setContextMenu(null) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    const hasType = e.dataTransfer.types.includes('application/reactflow-type')
    const hasImage = e.dataTransfer.types.includes('application/canvas-image')
    e.dataTransfer.dropEffect = hasType ? 'move' : hasImage ? 'copy' : 'move'
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const imageData = e.dataTransfer.getData('application/canvas-image')
    if (imageData) {
      try {
        const parsed = JSON.parse(imageData)
        addNode('reference', position)
        const s = useCanvasStore.getState()
        const newNode = s.nodes[s.nodes.length - 1]
        if (newNode) { s.updateNodeData(newNode.id, { label: parsed.name || 'Image', mediaType: 'image', mediaData: parsed.url, fileName: parsed.name || 'Generated' }) }
        return
      } catch {}
    }
    const type = e.dataTransfer.getData('application/reactflow-type')
    if (!type) return
    addNode(type, position)
  }, [screenToFlowPosition, addNode])

  const onNodeDoubleClick = useCallback((_, node) => {
    setRenameModal({ nodeId: node.id, name: node.data.label || node.type || '' })
  }, [])

  const handleRename = useCallback(() => {
    if (!renameModal) return
    useCanvasStore.getState().updateNodeData(renameModal.nodeId, { label: renameModal.name })
    setRenameModal(null)
  }, [renameModal])

  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault()
    selectNode(node.id)
    setContextMenu({ type: 'node', x: e.clientX, y: e.clientY, nodeId: node.id })
  }, [selectNode])

  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault()
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setContextMenu({ type: 'pane', x: e.clientX, y: e.clientY, position: pos })
  }, [screenToFlowPosition])

  const onPaneClick = useCallback(() => {
    deselectNode()
    useCanvasStore.getState().deselectEdge()
    setContextMenu(null)
  }, [deselectNode])

  const onEdgeClick = useCallback((e, edge) => {
    useCanvasStore.getState().selectEdge(edge.id)
  }, [])

  const handleEdgeDelete = useCallback((edgeId) => {
    deleteEdge(edgeId)
    setContextMenu(null)
  }, [deleteEdge])

  useEffect(() => {
    if (!selectedEdgeId) { setContextMenu(null); return }
    const edge = useCanvasStore.getState().edges.find((e) => e.id === selectedEdgeId)
    if (!edge) { setContextMenu(null); return }
    const src = useCanvasStore.getState().nodes.find((n) => n.id === edge.source)
    const tgt = useCanvasStore.getState().nodes.find((n) => n.id === edge.target)
    if (src && tgt) {
      setContextMenu({ type: 'edge', edgeId: selectedEdgeId,
        x: (src.position.x + tgt.position.x) / 2 + 80, y: (src.position.y + tgt.position.y) / 2 + 100 })
    }
  }, [selectedEdgeId])

  const displayNodes = useMemo(() => {
    if (!selectedNodeId || connectedNodeIds.size <= 1) return nodes
    return nodes.map(n => ({ ...n, className: connectedNodeIds.has(n.id) ? 'node-highlighted' : 'node-dimmed' }))
  }, [nodes, selectedNodeId, connectedNodeIds])

  return (
    <div className="w-full h-full relative" ref={wrapperRef} onClick={closeMenu} style={{ outline: 'none' }}>
      <ReactFlow
        nodes={displayNodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onPaneClick={onPaneClick} onPaneContextMenu={onPaneContextMenu}
        onEdgeClick={onEdgeClick}
        onNodeClick={(_, node) => useCanvasStore.getState().selectNode(node.id)}
        onNodeDoubleClick={onNodeDoubleClick} onNodeContextMenu={onNodeContextMenu}
        onDragOver={onDragOver} onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
        snapToGrid snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'default', animated: true,
          style: { stroke: '#6c63ff', strokeWidth: 3, strokeLinecap: 'round' },
        }}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#1a1a2e' }}
        onViewportChange={(vp) => setZoom(Math.round(vp?.zoom * 100) / 100)}
        isValidConnection={(connection) => {
          const s = useCanvasStore.getState()
          const src = s.nodes.find((n) => n.id === connection.source)
          const tgt = s.nodes.find((n) => n.id === connection.target)
          if (!src || !tgt || src.id === tgt.id) return false
          return validateConnection(src, tgt, connection.targetHandle)
        }}
      >
        <Background gap={24} size={2} color="#2a2a45" />
        <Background gap={96} size={2} color="#2a2a45" />
        <Controls />
        <MiniMap nodeColor={(n) => ({ textPrompt: '#6c63ff', mediaGen: '#e94560', imageGen: '#e94560', videoGen: '#0f3460', reference: '#4ade80', preview: '#38bdf8', agent: '#f5c518', pixelleVideo: '#f472b6' }[n.type] || '#6c63ff')} maskColor="rgba(0,0,0,0.4)" pannable zoomable />
      </ReactFlow>

      {/* Zoom indicator */}
      <div className="zoom-indicator">{Math.round(zoom * 100)}%</div>

      {/* Context Menu */}
      {contextMenu && (
        <div className="canvas-context-menu" style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 50 }}
          onClick={(e) => e.stopPropagation()}>
          {contextMenu.type === 'node' && (
            <>
              <button className="menu-item" onClick={() => { setRenameModal({ nodeId: contextMenu.nodeId, name: useCanvasStore.getState().nodes.find((n) => n.id === contextMenu.nodeId)?.data?.label || '' }); setContextMenu(null) }}>
                <span>Rename</span>
              </button>
              <button className="menu-item" onClick={() => { duplicateNode(contextMenu.nodeId); setContextMenu(null) }}>
                <span>Duplicate</span><span style={{fontSize:10,color:'#666'}}>Ctrl+D</span>
              </button>
              <div className="menu-divider" />
              <button className="menu-item danger" onClick={() => { deleteNode(contextMenu.nodeId); setContextMenu(null) }}>
                <span>Delete</span><span style={{fontSize:10}}>Del</span>
              </button>
            </>
          )}
          {contextMenu.type === 'pane' && (
            <>
              <div className="menu-label">Add Node</div>
              {QUICK_ADD_NODES.map((n) => (
                <button key={n.type} className="menu-item" onClick={() => { addNode(n.type, contextMenu.position); setContextMenu(null) }}>
                  {n.label}
                </button>
              ))}
            </>
          )}
          {contextMenu.type === 'edge' && (
            <>
              <div className="menu-label">Edge</div>
              <button className="menu-item danger" onClick={() => handleEdgeDelete(contextMenu.edgeId)}>
                Delete Edge
              </button>
            </>
          )}
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <>
          <div className="rename-overlay" onClick={() => setRenameModal(null)} />
          <div className="rename-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e0e0f0', marginBottom: 8 }}>Rename Node</div>
            <input value={renameModal.name} onChange={(e) => setRenameModal({ ...renameModal, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameModal(null) }} autoFocus />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRenameModal(null)}
                style={{ padding: '5px 12px', fontSize: 11, borderRadius: 5, border: '1px solid #2a2a45', background: 'transparent', color: '#888', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleRename}
                style={{ padding: '5px 12px', fontSize: 11, borderRadius: 5, border: 'none', background: '#6c63ff', color: '#fff', cursor: 'pointer' }}>OK</button>
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
