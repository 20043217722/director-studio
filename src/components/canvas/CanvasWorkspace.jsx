import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore, validateConnection } from './utils/canvasStore'
import { validateHandleTypes, DATA_TYPES } from './utils/typeSystem'
import { getFavorites, toggleFavorite, getRecents, addRecent } from './utils/nodeDefaults'
import { TextPromptNode } from './nodes/TextPromptNode'
import { MediaGenNode } from './nodes/MediaGenNode'
import { ReferenceNode } from './nodes/ReferenceNode'
import { PreviewNode } from './nodes/PreviewNode'
import { AgentNode } from './nodes/AgentNode'
import { PixelleVideoNode } from './nodes/PixelleVideoNode'
import { RerouteNode } from './nodes/RerouteNode'
import { PrimitiveNode } from './nodes/PrimitiveNode'
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
  textPrompt: TextPromptNode, mediaGen: MediaGenNode, imageGen: MediaGenNode, videoGen: MediaGenNode,
  reference: ReferenceNode, preview: PreviewNode, agent: AgentNode, pixelleVideo: PixelleVideoNode,
  reroute: RerouteNode,
  primitive: PrimitiveNode,
}

const NODE_CATEGORIES = [
  { name: '输入节点', items: [
    { type: 'textPrompt', label: '文本提示词', icon: 'T', color: '#6c63ff', desc: '输入创作描述' },
    { type: 'reference', label: '参考素材', icon: 'R', color: '#4ade80', desc: '上传图片/视频' },
  ]},
  { name: '生成节点', items: [
    { type: 'mediaGen', label: '媒体生成', icon: 'M', color: '#e94560', desc: '图片/视频生成' },
    { type: 'pixelleVideo', label: '短视频', icon: 'V', color: '#f472b6', desc: '一键短视频' },
  ]},
  { name: '分析节点', items: [
    { type: 'agent', label: 'AI 智能体', icon: 'A', color: '#f5c518', desc: '智能分析协作' },
  ]},
  { name: '输出节点', items: [
    { type: 'preview', label: '预览输出', icon: 'P', color: '#38bdf8', desc: '查看生成结果' },
  ]},
  { name: '工具节点', items: [
    { type: 'reroute', label: '中继节点', icon: '>', color: '#6c63ff', desc: '整理走线路径' },
  ]},
]

function smartAutoLayout(nodes, edges) {
  if (!nodes.length) return nodes
  const adj = {}; const inDeg = {}
  nodes.forEach(n => { adj[n.id] = []; inDeg[n.id] = 0 })
  edges.forEach(e => { if (adj[e.source] && adj[e.target] !== undefined) { adj[e.source].push(e.target); inDeg[e.target] = (inDeg[e.target]||0) + 1 } })
  const queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id)
  const layers = []; const layerMap = {}
  if (!queue.length) { queue.push(nodes[0].id) }
  while (queue.length) {
    const level = []; const nextQueue = []
    for (const id of queue) { level.push(id); layerMap[id] = layers.length; for (const t of adj[id]) { inDeg[t]--; if (inDeg[t] === 0) nextQueue.push(t) } }
    layers.push(level); queue.length = 0; queue.push(...nextQueue)
  }
  nodes.forEach(n => { if (layerMap[n.id] === undefined) { layerMap[n.id] = layers.length; layers.push([n.id]) } })
  const layerXs = layers.map((_, i) => 80 + i * 340)
  return nodes.map(n => {
    const layer = layerMap[n.id]; const idxInLayer = layers[layer]?.indexOf(n.id) || 0
    const totalInLayer = layers[layer]?.length || 1
    return { ...n, position: { x: layerXs[layer], y: Math.max(0, 80 + (idxInLayer - (totalInLayer - 1) / 2) * 280) } }
  })
}

function alignSelectedNodes(nodes, alignment) {
  if (nodes.length < 2) return nodes
  let refVal
  switch (alignment) {
    case 'left': refVal = Math.min(...nodes.map(n => n.position.x)); break
    case 'center': refVal = nodes.reduce((s, n) => s + n.position.x, 0) / nodes.length; break
    case 'right': refVal = Math.max(...nodes.map(n => n.position.x)); break
    case 'top': refVal = Math.min(...nodes.map(n => n.position.y)); break
    case 'middle': refVal = nodes.reduce((s, n) => s + n.position.y, 0) / nodes.length; break
    case 'bottom': refVal = Math.max(...nodes.map(n => n.position.y)); break
    default: return nodes
  }
  return nodes.map(n => ({ ...n, position: { x: ['left','center','right'].includes(alignment) ? refVal : n.position.x, y: ['top','middle','bottom'].includes(alignment) ? refVal : n.position.y } }))
}

function distributeNodes(nodes, direction) {
  if (nodes.length < 3) return nodes
  const sorted = [...nodes].sort((a, b) => direction === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y)
  const first = sorted[0].position; const last = sorted[sorted.length - 1].position
  const total = direction === 'horizontal' ? (last.x - first.x) : (last.y - first.y)
  if (total <= 0) return nodes
  const step = total / (sorted.length - 1)
  return nodes.map(n => { const idx = sorted.indexOf(n); if (idx <= 0 || idx >= sorted.length - 1) return n; return { ...n, position: { x: direction === 'horizontal' ? first.x + step * idx : n.position.x, y: direction === 'vertical' ? first.y + step * idx : n.position.y } } })
}

export default function CanvasWorkspace() { return <ReactFlowProvider><CanvasInner /></ReactFlowProvider> }

function CanvasInner() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, selectedNodeId, selectedEdgeId,
    deselectNode, deleteEdge, deleteNode, undo, redo, duplicateNode, addNode, selectNode,
    insertNodeBetween, updateNodeData, groups, createGroup, deleteGroup } = useCanvasStore()
  const [zoom, setZoom] = useState(1)
  const [contextMenu, setContextMenu] = useState(null)
  const [renameModal, setRenameModal] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteSearch, setPaletteSearch] = useState('')
  const [selectedNodeIds, setSelectedNodeIds] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [edgeTooltip, setEdgeTooltip] = useState(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const [connTooltip, setConnTooltip] = useState(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [runHistory, setRunHistory] = useState([])
  const { screenToFlowPosition, fitView, getViewport } = useReactFlow()
  const wrapperRef = useRef(null); const searchRef = useRef(null)

  const connectedNodeIds = useMemo(() => selectedNodeId ? getConnectedNodeIds(selectedNodeId, edges) : new Set(), [selectedNodeId, edges])
  const closeMenu = useCallback(() => setContextMenu(null), [])

  // === TOAST auto-dismiss ===

  // === FETCH RUN HISTORY ===
  useEffect(() => {
    if (!wfRunning) {
      fetch('http://localhost:3001/api/workflow/history').then(r => r.json()).then(data => setRunHistory(data || [])).catch(() => {})
    }
  }, [wfRunning])
  useEffect(() => { if (toastMsg) { const t = setTimeout(() => setToastMsg(null), 2000); return () => clearTimeout(t) } }, [toastMsg])
  // Load favorites & recents from localStorage after mount
  useEffect(() => {
    try { setFavs(getFavorites()) } catch {}
    try { setRecents(getRecents()) } catch {}
  }, [])
  // === WORKFLOW EXECUTION (Backend Engine) ===
  const [wfRunning, setWfRunning] = useState(false)
  const [wfStatus, setWfStatus] = useState({})

  const handleSubmitWorkflow = useCallback(async () => {
    if (!nodes.length) return
    setWfRunning(true); setToastMsg('提交工作流到后端引擎...')
    const apiKeys = (() => { try { return JSON.parse(localStorage.getItem('api_keys') || '{}') } catch { return {} } })()
    try {
      const res = await fetch('http://localhost:3001/api/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })), edges, apiKeys, config: { stopOnError: false } }),
      })
      const { runId } = await res.json()
      setWfStatus({ runId, status: 'started' })
      setToastMsg('执行已启动: ' + runId)
      const sse = new EventSource('http://localhost:3001/api/workflow/stream/' + runId)
      sse.addEventListener('node:start', (e) => {
        const { nodeId } = JSON.parse(e.data)
        setWfStatus(prev => ({ ...prev, [nodeId]: 'running' }))
        useCanvasStore.getState().updateNodeData(nodeId, { status: 'generating' })
      })
      sse.addEventListener('node:progress', (e) => {
        const { nodeId, progress } = JSON.parse(e.data)
        setWfStatus(prev => ({ ...prev, [nodeId]: 'progress:' + progress }))
        useCanvasStore.getState().updateNodeData(nodeId, { progress, status: 'generating' })
      })
      sse.addEventListener('node:done', (e) => {
        const { nodeId, output } = JSON.parse(e.data)
        setWfStatus(prev => ({ ...prev, [nodeId]: 'done' }))
        const s = useCanvasStore.getState()
        if (output?.images?.length) { s.updateNodeData(nodeId, { generatedImages: output.images, status: 'done', progress: 100 }) }
        else if (output?.text) { s.updateNodeData(nodeId, { response: output.text, status: 'done' }) }
        else { s.updateNodeData(nodeId, { status: 'done', progress: 100 }) }
      })
      sse.addEventListener('node:error', (e) => {
        const { nodeId, error } = JSON.parse(e.data)
        setWfStatus(prev => ({ ...prev, [nodeId]: 'error' }))
        useCanvasStore.getState().updateNodeData(nodeId, { status: 'error', errorMessage: error })
      })
      sse.addEventListener('workflow:done', (e) => {
        const { duration } = JSON.parse(e.data)
        setWfRunning(false); setToastMsg('工作流执行完成 (' + (duration / 1000).toFixed(1) + 's)')
        sse.close()
      })
      sse.addEventListener('workflow:stopped', () => { setWfRunning(false); setToastMsg('工作流已停止'); sse.close() })
      sse.onerror = () => { sse.close(); setWfRunning(false) }
    } catch (err) { setWfRunning(false); setToastMsg('后端连接失败，请确保 npm run proxy 已启动') }
  }, [nodes, edges])



  // === SPACE DRAG + KEYBOARD ===
  useEffect(() => {
    const spaceDown = (e) => { if (e.code === 'Space' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) { e.preventDefault(); setSpaceHeld(true) } }
    const spaceUp = (e) => { if (e.code === 'Space') setSpaceHeld(false) }
    window.addEventListener('keydown', spaceDown); window.addEventListener('keyup', spaceUp)

    const handle = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        if (e.ctrlKey && e.key === 'f') { e.preventDefault(); setSearchOpen(true); return }
        return
      }
      const s = useCanvasStore.getState()
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); s.undo(); setToastMsg('已撤销') }
      if ((e.ctrlKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) { e.preventDefault(); s.redo(); setToastMsg('已重做') }
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); if (s.selectedNodeId) { s.duplicateNode(s.selectedNodeId); setToastMsg('已复制') } }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50) }
      if (e.ctrlKey && e.key === 'm' && s.selectedNodeId) { e.preventDefault(); s.updateNodeData(s.selectedNodeId, { muted: !s.nodes.find(n => n.id === s.selectedNodeId)?.data?.muted }) }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleRunChain() }
      if (e.ctrlKey && e.key === 'g' && selectedNodeIds.length >= 2) { e.preventDefault(); const name = prompt('输入节点组名称：', '节点组'); if (name) { s.createGroup(name, [...selectedNodeIds], '#6c63ff'); setToastMsg('已创建组: ' + name) } }
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); addBookmark() }
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); setPaletteOpen(v => !v) }
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (s.selectedNodeId) { e.preventDefault(); s.deleteNode(s.selectedNodeId); setToastMsg('已删除') }
        if (selectedNodeIds.length >= 2) { selectedNodeIds.forEach(id => s.deleteNode(id)); setSelectedNodeIds([]); setToastMsg('已删除 ' + selectedNodeIds.length + ' 个节点') }
      }
      if (e.key === 'Escape') { s.deselectNode(); s.deselectEdge(); setContextMenu(null); setSearchOpen(false); setPaletteOpen(false) }
    }
    window.addEventListener('keydown', handle)
    return () => { window.removeEventListener('keydown', handle); window.removeEventListener('keydown', spaceDown); window.removeEventListener('keyup', spaceUp) }
  }, [selectedNodeIds])

  // === RUN CHAIN: execute all upstream nodes in topological order ===
  const handleRunChain = useCallback(() => {
    const s = useCanvasStore.getState()
    const targetId = s.selectedNodeId || selectedNodeIds[0]
    if (!targetId) return
    const upstreamIds = new Set(); const queue = [targetId]
    while (queue.length) {
      const current = queue.shift()
      s.edges.filter(e => e.target === current).forEach(e => { if (!upstreamIds.has(e.source)) { upstreamIds.add(e.source); queue.push(e.source) } })
    }
    upstreamIds.add(targetId)
    const sorted = []; const visited = new Set()
    const visit = (id) => { if (visited.has(id)) return; visited.add(id); s.edges.filter(e => e.target === id).forEach(e => visit(e.source)); if (upstreamIds.has(id)) sorted.push(id) }
    visit(targetId)
    sorted.forEach((nodeId, i) => {
      setTimeout(() => { window.dispatchEvent(new CustomEvent('run-chain', { detail: { nodeId } })) }, i * 800)
    })
    setToastMsg('运行上游链: ' + sorted.length + ' 个节点')
  }, [selectedNodeIds])

  // === SEARCH ===
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return nodes.filter(n => (n.data?.label || n.type || '').toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8)
  }, [searchQuery, nodes])
  const gotoNode = useCallback((nodeId) => { const node = nodes.find(n => n.id === nodeId); if (node) { fitView({ nodes: [{ id: nodeId }], duration: 400, maxZoom: 1.5 }); selectNode(nodeId); setSearchOpen(false); setSearchQuery('') } }, [nodes, fitView, selectNode])

  // === SMART LAYOUT ===
  const handleSmartLayout = useCallback(() => {
    const s = useCanvasStore.getState(); s._pushUndo()
    const positioned = smartAutoLayout(s.nodes, s.edges)
    useCanvasStore.setState({ nodes: positioned }); setToastMsg('智能排列完成')
  }, [])

  // === BOOKMARKS ===
  const addBookmark = useCallback(() => {
    const vp = getViewport(); const name = '视点 ' + (bookmarks.length + 1)
    setBookmarks(prev => [...prev, { id: Date.now(), name, x: vp.x, y: vp.y, zoom: vp.zoom }]); setToastMsg('已添加书签')
  }, [bookmarks, getViewport])
  const gotoBookmark = useCallback((bm) => { fitView({ duration: 400 }) }, [fitView])
  const removeBookmark = useCallback((id) => { setBookmarks(prev => prev.filter(b => b.id !== id)) }, [])

  // === SELECTION ===
  const onSelectionChange = useCallback(({ nodes: selNodes }) => { setSelectedNodeIds(selNodes.map(n => n.id)) }, [])

  // === ALIGNMENT ===
  const handleAlign = useCallback((alignment) => {
    if (selectedNodeIds.length < 2) return
    const s = useCanvasStore.getState(); s._pushUndo()
    const selNodes = s.nodes.filter(n => selectedNodeIds.includes(n.id))
    const newNodes = s.nodes.map(n => { const an = alignSelectedNodes(selNodes, alignment).find(a => a.id === n.id); return an || n })
    useCanvasStore.setState({ nodes: newNodes })
  }, [selectedNodeIds])
  const handleDistribute = useCallback((direction) => {
    if (selectedNodeIds.length < 3) return
    const s = useCanvasStore.getState(); s._pushUndo()
    const selNodes = s.nodes.filter(n => selectedNodeIds.includes(n.id))
    const newNodes = s.nodes.map(n => { const dn = distributeNodes(selNodes, direction).find(d => d.id === n.id); return dn || n })
    useCanvasStore.setState({ nodes: newNodes })
  }, [selectedNodeIds])

  // === PALETTE FAVORITES & RECENTS ===
  const [favs, setFavs] = useState([])
  const [recents, setRecents] = useState([])
  const handlePaletteAddTracked = useCallback((type) => {
    addRecent(type); setRecents(getRecents())
    addNode(type); setPaletteOpen(false); setPaletteSearch('')
  }, [addNode])
  const handleToggleFav = useCallback((type) => {
    const newFavs = toggleFavorite(type); setFavs(newFavs)
    setToastMsg(getFavorites().includes(type) ? '已收藏' : '已取消收藏')
  }, [])

  // === PALETTE ===
  const filteredCategories = useMemo(() => {
    if (!paletteSearch.trim()) return NODE_CATEGORIES
    return NODE_CATEGORIES.map(cat => ({ ...cat, items: cat.items.filter(item => item.label.includes(paletteSearch) || item.type.includes(paletteSearch) || item.desc.includes(paletteSearch)) })).filter(cat => cat.items.length > 0)
  }, [paletteSearch])
  const handlePaletteAdd = useCallback((type) => { addNode(type); setPaletteOpen(false); setPaletteSearch('') }, [addNode])

  // === DRAG/DROP ===
  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }, [])
  const onDrop = useCallback((e) => {
    e.preventDefault(); const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const imageData = e.dataTransfer.getData('application/canvas-image')
    if (imageData) { try { const parsed = JSON.parse(imageData); addNode('reference', position); const s = useCanvasStore.getState(); const newNode = s.nodes[s.nodes.length - 1]; if (newNode) s.updateNodeData(newNode.id, { label: parsed.name || '素材', mediaType: 'image', mediaData: parsed.url, fileName: parsed.name || '图片' }); return } catch {} }
    const type = e.dataTransfer.getData('application/reactflow-type'); if (!type) return; addNode(type, position)
  }, [screenToFlowPosition, addNode])

  // === CONNECTION TOOLTIP ===
  const onConnectStart = useCallback((_, { nodeId, handleId }) => {
    const s = useCanvasStore.getState(); const n = s.nodes.find(x => x.id === nodeId)
    if (n) { const labels = {textPrompt:'提示词输出',agent:'分析输出',reference:'素材输出',preview:'预览输出',mediaGen:'媒体输出',imageGen:'图片输出',videoGen:'视频输出',reroute:'数据中继'}; setConnTooltip({ label: labels[n.type]||'数据输出', nodeId }) }
  }, [])
  const onConnectEnd = useCallback(() => setConnTooltip(null), [])

  // === EDGE ===
  const onEdgeMouseEnter = useCallback((e, edge) => {
    const src = nodes.find(n => n.id === edge.source); if (src?.data?.generatedImages?.length) { const img = src.data.generatedImages[0]; const url = img.url || img.base64; if (url) setEdgeTooltip({ x: e.clientX, y: e.clientY, url, label: '图片数据流' }) }
    else if (edge.label) { setEdgeTooltip({ x: e.clientX, y: e.clientY, url: null, label: edge.label || '' }) }
  }, [nodes])
  const onEdgeMouseLeave = useCallback(() => setEdgeTooltip(null), [])
  const onNodeDoubleClick = useCallback((_, node) => { setRenameModal({ nodeId: node.id, name: node.data.label || node.type || '' }) }, [])
  const handleRename = useCallback(() => { if (!renameModal) return; useCanvasStore.getState().updateNodeData(renameModal.nodeId, { label: renameModal.name }); setRenameModal(null) }, [renameModal])
  const onNodeContextMenu = useCallback((e, node) => { e.preventDefault(); selectNode(node.id); setContextMenu({ type: 'node', x: e.clientX, y: e.clientY, nodeId: node.id }) }, [selectNode])
  const onPaneContextMenu = useCallback((e) => { e.preventDefault(); const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY }); setContextMenu({ type: 'pane', x: e.clientX, y: e.clientY, position: pos }) }, [screenToFlowPosition])
  const onPaneClick = useCallback(() => { deselectNode(); useCanvasStore.getState().deselectEdge(); setContextMenu(null); setPaletteOpen(false) }, [deselectNode])
  const onEdgeClick = useCallback((e, edge) => { useCanvasStore.getState().selectEdge(edge.id) }, [])
  const handleEdgeDelete = useCallback((edgeId) => { deleteEdge(edgeId); setContextMenu(null) }, [deleteEdge])

  useEffect(() => { if (!selectedEdgeId) { setContextMenu(null); return }; const edge = useCanvasStore.getState().edges.find((e) => e.id === selectedEdgeId); if (!edge) return; const src = useCanvasStore.getState().nodes.find((n) => n.id === edge.source); const tgt = useCanvasStore.getState().nodes.find((n) => n.id === edge.target); if (src && tgt) setContextMenu({ type: 'edge', edgeId: selectedEdgeId, x: (src.position.x + tgt.position.x) / 2 + 80, y: (src.position.y + tgt.position.y) / 2 + 100 }) }, [selectedEdgeId])

  const displayNodes = useMemo(() => {
    if (!selectedNodeId || connectedNodeIds.size <= 1) return nodes
    return nodes.map(n => ({ ...n, className: connectedNodeIds.has(n.id) ? 'node-highlighted' : 'node-dimmed' }))
  }, [nodes, selectedNodeId, connectedNodeIds])

  // === GROUP RECTS ===
  const groupRects = useMemo(() => {
    if (!groups || !groups.length) return []
    return groups.map(g => { const groupNodes = nodes.filter(n => g.nodeIds.includes(n.id)); if (!groupNodes.length) return null; const minX = Math.min(...groupNodes.map(n => n.position.x)) - 20; const minY = Math.min(...groupNodes.map(n => n.position.y)) - 40; const maxX = Math.max(...groupNodes.map(n => n.position.x + 280)); const maxY = Math.max(...groupNodes.map(n => n.position.y + 200)); return { ...g, x: minX, y: minY, width: maxX - minX, height: maxY - minY } }).filter(Boolean)
  }, [groups, nodes])

  return (
    <div className="w-full h-full relative" ref={wrapperRef} onClick={closeMenu} style={{ outline: 'none' }}>
      <svg style={{ position: 'absolute', width: 0, height: 0, zIndex: -1 }}>
        <defs>
          <marker id="arrow-prompt" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 4 L 0 8 z" fill="#6c63ff" /></marker>
          <marker id="arrow-image" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 4 L 0 8 z" fill="#e94560" /></marker>
          <marker id="arrow-video" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 4 L 0 8 z" fill="#0f3460" /></marker>
          <marker id="arrow-agent" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 4 L 0 8 z" fill="#f5c518" /></marker>
          <marker id="arrow-reference" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 4 L 0 8 z" fill="#4ade80" /></marker>
          <marker id="arrow-media" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 4 L 0 8 z" fill="#8b5cf6" /></marker>
          <marker id="arrow-preview" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 4 L 0 8 z" fill="#38bdf8" /></marker>
        </defs>
      </svg>

      <ReactFlow nodes={displayNodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onConnectStart={onConnectStart} onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick} onPaneContextMenu={onPaneContextMenu}
        onEdgeClick={onEdgeClick} onEdgeMouseEnter={onEdgeMouseEnter} onEdgeMouseLeave={onEdgeMouseLeave}
        onNodeClick={(_, node) => useCanvasStore.getState().selectNode(node.id)}
        onNodeDoubleClick={onNodeDoubleClick} onNodeContextMenu={onNodeContextMenu}
        onDragOver={onDragOver} onDrop={onDrop} nodeTypes={nodeTypes}
        panOnDrag={spaceHeld ? [0,1,2] : [1,2]}
        onSelectionChange={onSelectionChange}
        fitView deleteKeyCode={null} multiSelectionKeyCode="Shift" selectionMode="partial"
        snapToGrid snapGrid={[16, 16]}
        connectionLineStyle={{ stroke: '#6c63ff', strokeWidth: 2.5, strokeDasharray: '6 4' }}
        defaultEdgeOptions={{ type: 'default', animated: true, style: { stroke: '#6c63ff', strokeWidth: 2.5, strokeLinecap: 'round' } }}
        proOptions={{ hideAttribution: true }} style={{ background: '#1a1a2e' }}
        onViewportChange={(vp) => setZoom(Math.round(vp?.zoom * 100) / 100)}
        isValidConnection={(connection) => { const s = useCanvasStore.getState(); const src = s.nodes.find((n) => n.id === connection.source); const tgt = s.nodes.find((n) => n.id === connection.target); if (!src || !tgt || src.id === tgt.id) return false; const base = validateConnection(src, tgt, connection.targetHandle); if (!base) return false; const typeCheck = validateHandleTypes(src, connection.sourceHandle, tgt, connection.targetHandle); if (!typeCheck.valid) { setConnTooltip({ label: typeCheck.reason, error: true }); return false; } return true }}>
        <Background gap={24} size={2} color="#2a2a45" />
        <Background gap={96} size={2} color="#2a2a45" />
        <Controls />
        <MiniMap nodeColor={(n) => ({ textPrompt: '#6c63ff', mediaGen: '#e94560', agent: '#f5c518', reference: '#4ade80', preview: '#38bdf8', pixelleVideo: '#f472b6' }[n.type] || '#6c63ff')} maskColor="rgba(0,0,0,0.4)" pannable zoomable />
      </ReactFlow>

      {/* Group Rects */}
      {groupRects.map(g => (<div key={g.id} className="canvas-group" style={{ left: g.x, top: g.y, width: g.width, height: g.height }}><div className="canvas-group-header" onClick={() => fitView({ nodes: g.nodeIds.map(id => ({ id })), duration: 400, padding: 0.3 })}>{g.name} ({g.nodeIds.length})</div></div>))}

      {/* Zoom indicator */}
      <div className="zoom-indicator">{Math.round(zoom * 100)}%</div>

      {/* Node Palette */}
      <button className="palette-toggle-btn" onClick={() => setPaletteOpen(v => !v)} title="节点面板 Ctrl+P" style={{ position: 'absolute', top: 12, left: 60, zIndex: 11 }}>{paletteOpen ? 'x' : '+'}</button>
      {paletteOpen && (<div className="canvas-node-palette" onClick={(e) => e.stopPropagation()}><input value={paletteSearch} onChange={(e) => setPaletteSearch(e.target.value)} placeholder="搜索节点..." autoFocus />          {/* Favorites + Recents */}
          {(favs.length > 0 || recents.length > 0) && (
            <div>
              {favs.length > 0 && (<div><div className='palette-category'>收藏</div>
                {favs.map(type => { const item = NODE_CATEGORIES.flatMap(cat => cat.items).find(i => i.type === type); if (!item) return null;
                  return (<button key={'fav_'+type} className='palette-item' onClick={() => handlePaletteAddTracked(item.type)}>
                    <span className='palette-item-icon' style={{background: item.color + '22', color: item.color}}>{item.icon}</span>
                    <span>{item.label}</span>
                    <span onClick={(e) => { e.stopPropagation(); handleToggleFav(type) }} style={{fontSize:9,color:'#ef4444',marginLeft:'auto',cursor:'pointer'}}>x</span>
                  </button>) })}</div>)}
              {recents.length > 0 && (<div><div className='palette-category'>最近使用</div>
                {recents.slice(0,4).map(type => { const item = NODE_CATEGORIES.flatMap(cat => cat.items).find(i => i.type === type); if (!item) return null;
                  return (<button key={'rec_'+type} className='palette-item' onClick={() => handlePaletteAddTracked(item.type)}>
                    <span className='palette-item-icon' style={{background: item.color + '22', color: item.color}}>{item.icon}</span>
                    <span>{item.label}</span>
                    <span onClick={(e) => { e.stopPropagation(); handleToggleFav(type) }} style={{fontSize:9,color: favs.includes(type) ? '#f5c518' : '#666', marginLeft:'auto', cursor:'pointer'}}>
                      {favs.includes(type) ? '★' : '☆'}
                    </span>
                  </button>) })}</div>)}
              <div className='menu-divider' />
            </div>)}

            {filteredCategories.map(cat => (<div key={cat.name}><div className="palette-category">{cat.name}</div>{cat.items.map(item => (<button key={item.type} className="palette-item" onClick={() => handlePaletteAddTracked(item.type)} onDragStart={(e) => { e.dataTransfer.setData('application/reactflow-type', item.type); e.dataTransfer.effectAllowed = 'move'; setPaletteOpen(false) }} draggable><span className="palette-item-icon" style={{background: item.color + '22', color: item.color}}>{item.icon}</span><span>{item.label}</span><span className="palette-item-desc">{item.desc}</span></button>))}</div>))}{filteredCategories.length === 0 && <div style={{padding:20,textAlign:'center',fontSize:11,color:'#666'}}>无匹配节点</div>}</div>)}

      {/* Search Bar */}
      {searchOpen && (<div className="canvas-search-bar" onClick={(e) => e.stopPropagation()} style={{zIndex:15}}><span style={{fontSize:12,color:'#888'}}>搜索</span><input ref={searchRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="输入节点名称..." autoFocus onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') } if (e.key === 'Enter' && searchResults.length > 0) gotoNode(searchResults[0].id) }} /><span className="canvas-search-result">{searchResults.length} 个结果</span><button onClick={() => { setSearchOpen(false); setSearchQuery('') }} style={{background:'transparent',border:'none',color:'#888',cursor:'pointer',fontSize:14}}>x</button>{searchResults.length > 0 && (<div style={{position:'absolute',top:'100%',left:0,right:0,marginTop:4,background:'#1e1e32',border:'1px solid #2a2a45',borderRadius:8,maxHeight:200,overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>{searchResults.map(n => (<button key={n.id} onClick={() => gotoNode(n.id)} style={{width:'100%',padding:'8px 12px',fontSize:12,textAlign:'left',border:'none',background:'transparent',color:'#d0d0e0',cursor:'pointer',display:'flex',justifyContent:'space-between'}} onMouseEnter={(e) => e.target.style.background='#2a2a45'} onMouseLeave={(e) => e.target.style.background='transparent'}><span>{n.data?.label || n.type}</span><span style={{fontSize:10,color:'#666'}}>{n.type}</span></button>))}</div>)}</div>)}

      {/* Alignment Bar */}
      {selectedNodeIds.length >= 2 && (<div className="canvas-align-bar" onClick={(e) => e.stopPropagation()}><span style={{fontSize:10,color:'#666',marginRight:4}}>{selectedNodeIds.length} 选中</span><button className="canvas-align-btn" onClick={() => handleAlign('left')}>左齐</button><button className="canvas-align-btn" onClick={() => handleAlign('center')}>中齐</button><button className="canvas-align-btn" onClick={() => handleAlign('right')}>右齐</button><button className="canvas-align-btn" onClick={() => handleAlign('top')}>顶齐</button><button className="canvas-align-btn" onClick={() => handleAlign('middle')}>竖中</button><button className="canvas-align-btn" onClick={() => handleAlign('bottom')}>底齐</button><div style={{width:1,height:16,background:'#2a2a45',margin:'0 4px'}} /><button className="canvas-align-btn" onClick={() => handleDistribute('horizontal')}>横分</button><button className="canvas-align-btn" onClick={() => handleDistribute('vertical')}>竖分</button></div>)}

      {/* Bookmarks */}
      {bookmarks.length > 0 && (<div className="canvas-bookmarks">{bookmarks.map(bm => (<button key={bm.id} className="canvas-bookmark-btn" onClick={() => gotoBookmark(bm)} title={bm.name}>{bm.name}<span onClick={(e) => { e.stopPropagation(); removeBookmark(bm.id) }} style={{marginLeft:4,color:'#666',fontSize:10}}>x</span></button>))}</div>)}

      {/* Edge Tooltip */}
      {edgeTooltip && (<div className="edge-tooltip" style={{ left: edgeTooltip.x + 16, top: edgeTooltip.y - 10 }}><div>{edgeTooltip.label}</div>{edgeTooltip.url && <img src={edgeTooltip.url} alt="" />}</div>)}

      {/* Connection Tooltip */}
      {connTooltip && (<div className="connection-tooltip" style={{ left: typeof window !== 'undefined' ? window.innerWidth / 2 : 400, top: 60 }}>{connTooltip.label}</div>)}

      {/* Context Menu */}
      {contextMenu && (<div className="canvas-context-menu" style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 50 }} onClick={(e) => e.stopPropagation()}>
        {contextMenu.type === 'node' && (<><button className="menu-item" onClick={() => { setRenameModal({ nodeId: contextMenu.nodeId, name: useCanvasStore.getState().nodes.find((n) => n.id === contextMenu.nodeId)?.data?.label || '' }); setContextMenu(null) }}><span>重命名</span></button><button className="menu-item" onClick={() => { duplicateNode(contextMenu.nodeId); setContextMenu(null) }}><span>复制</span></button><button className="menu-item" onClick={() => { handleRunChain(); setContextMenu(null) }}><span>运行上游链</span><span style={{fontSize:10,color:'#4ade80'}}>Ctrl+Enter</span></button><button className="menu-item" onClick={() => { const s = useCanvasStore.getState(); s.updateNodeData(contextMenu.nodeId, { collapsed: !s.nodes.find(n => n.id === contextMenu.nodeId)?.data?.collapsed }); setContextMenu(null) }}><span>折叠</span></button><div className="menu-divider" /><button className="menu-item danger" onClick={() => { deleteNode(contextMenu.nodeId); setContextMenu(null) }}><span>删除</span></button></>)}
        {contextMenu.type === 'pane' && NODE_CATEGORIES.map(cat => (<div key={cat.name}><div className="menu-label">{cat.name}</div>{cat.items.map(item => (<button key={item.type} className="menu-item" onClick={() => { addNode(item.type, contextMenu.position); setContextMenu(null) }}><span style={{color: item.color, marginRight: 6}}>{item.icon}</span><span>{item.label}</span></button>))}</div>))}
        {contextMenu.type === 'edge' && (<><div className="menu-label">连线</div><button className="menu-item danger" onClick={() => handleEdgeDelete(contextMenu.edgeId)}>删除连线</button></>)}
      </div>)}

      {/* Rename Modal */}
      {renameModal && (<><div className="rename-overlay" onClick={() => setRenameModal(null)} /><div className="rename-modal" onClick={(e) => e.stopPropagation()}><div style={{ fontSize: 12, fontWeight: 700, color: '#e0e0f0', marginBottom: 8 }}>重命名节点</div><input value={renameModal.name} onChange={(e) => setRenameModal({ ...renameModal, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameModal(null) }} autoFocus /><div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setRenameModal(null)} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 5, border: '1px solid #2a2a45', background: 'transparent', color: '#888', cursor: 'pointer' }}>取消</button><button onClick={handleRename} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 5, border: 'none', background: '#6c63ff', color: '#fff', cursor: 'pointer' }}>确定</button></div></div></>)}

      {/* Toast */}
      {toastMsg && <div className="canvas-toast">{toastMsg}</div>}

      {/* Status Bar */}
      <div className="canvas-statusbar">
        <span className="stat-item">节点 <span className="stat-value">{nodes.length}</span></span>
        <span className="stat-item">选中 <span className="stat-value">{selectedNodeIds.length || (selectedNodeId ? 1 : 0)}</span></span>
        <span style={{flex:1}} />
        <span className="stat-item">Space拖拽 | Ctrl+Enter运行链 | Ctrl+F搜索 | Ctrl+P面板</span>
      </div>


      {/* Execution Queue Toggle */}
      <button className={'queue-toggle-btn' + (wfRunning ? ' has-active' : '')} onClick={() => setQueueOpen(v => !v)} title="执行队列" style={{ position: 'absolute', top: 12, right: 12, zIndex: 11 }}>
        {queueOpen ? 'x' : (wfRunning ? '>' : 'Q')}
      </button>

      {/* Execution Queue Panel */}
      {queueOpen && (
        <div className="queue-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 12, right: 12, zIndex: 12 }}>
          <div className="queue-panel-header">
            <span>执行队列</span>
            <button onClick={() => setQueueOpen(false)} style={{background:'transparent',border:'none',color:'#888',cursor:'pointer',fontSize:14}}>x</button>
          </div>
          {runHistory.length === 0 ? (
            <div style={{padding:20,textAlign:'center',fontSize:11,color:'#666'}}>暂无执行记录</div>
          ) : (
            runHistory.map(r => (
              <div key={r.id} className="queue-run-item"
                onClick={() => setToastMsg('运行ID: ' + r.id)}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <span className={'queue-run-status ' + (r.status === 'done' ? 'done' : r.status === 'stopped' ? 'error' : 'running')} />
                    <span className="queue-run-id">{r.id.slice(0, 20)}</span>
                  </div>
                  <span style={{fontSize:10,color:'#888'}}>{(r.duration / 1000).toFixed(1)}s</span>
                </div>
                <div className="queue-run-meta">
                  {r.batch ? '参数扫描' : '工作流'} · {r.doneNodes || 0}/{r.totalNodes || 0} 成功 {r.errorNodes > 0 ? '· ' + r.errorNodes + ' 错误' : ''}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      
      <ProjectBiblePanel />
      <NodeConfigPanel />
      <CanvasInputBar />
      {nodes.length === 0 && <CanvasWelcome />}
    </div>
  )
}
