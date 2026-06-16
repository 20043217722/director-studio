import { useCallback, useState, useEffect } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, SelectionMode,
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
import { CanvasToolbar } from './CanvasToolbar'
import { NodeConfigPanel } from './NodeConfigPanel'
import { CanvasWelcome } from './CanvasWelcome'

const nodeTypes = {
  textPrompt: TextPromptNode, imageGen: ImageGenNode,
  videoGen: VideoGenNode, reference: ReferenceNode,
  preview: PreviewNode, agent: AgentNode,
}

const NODE_COLORS = {
  textPrompt: 'var(--accent-tts)',
  imageGen: 'var(--accent-music)',
  videoGen: 'var(--accent-sfx)',
  reference: 'var(--accent-clone)',
  preview: 'var(--brand)',
  agent: 'var(--brand)',
}

export default function CanvasWorkspace() {
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    selectedNodeId, deselectNode, deleteEdge, undo, redo, deleteNode,
  } = useCanvasStore()
  const [zoom, setZoom] = useState(1)
  const { fitView } = useReactFlow()

  const onPaneClick = useCallback(() => deselectNode(), [deselectNode])

  const onEdgeClick = useCallback((_, edge) => {
    deleteEdge(edge.id)
  }, [deleteEdge])

  // Keyboard shortcuts (global, even when ReactFlow has focus)
  useEffect(() => {
    const handle = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      const store = useCanvasStore.getState()
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); store.undo() }
      if (e.ctrlKey && e.key === 'Z') { e.preventDefault(); store.redo() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); store.redo() }
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); /* select all handled by ReactFlow */ }
      if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedNodeId) {
        store.deleteNode(store.selectedNodeId)
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  return (
    <div className="w-full h-full relative" style={{ outline: 'none' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        onNodeClick={(_, node) => useCanvasStore.getState().selectNode(node.id)}
        onMoveEnd={() => {
          // Trigger state save after drag
        }}
        nodeTypes={nodeTypes}
        fitView
        selectionMode={SelectionMode.Partial}
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
      >
        <Background gap={24} size={1} color="var(--border)" />
        <Controls style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
        }} />
        <MiniMap
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}
          nodeColor={(node) => NODE_COLORS[node.type] || 'var(--accent)'}
          maskColor="rgba(0,0,0,0.4)"
        />
      </ReactFlow>

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 10,
        fontSize: 11, color: 'var(--text-muted)',
        background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)', borderRadius: 6,
        padding: '4px 10px',
      }}>
        {Math.round(zoom * 100)}%
      </div>

      <CanvasToolbar undo={undo} redo={redo} fitView={fitView} />
      <NodeConfigPanel />

      {nodes.length === 0 && <CanvasWelcome />}
    </div>
  )
}
