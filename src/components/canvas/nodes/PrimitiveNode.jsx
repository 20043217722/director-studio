import { memo, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '../utils/canvasStore'

const VALUE_TYPES = [
  { id: 'string', label: '字符串', color: '#6c63ff' },
  { id: 'int', label: '整数', color: '#22c55e' },
  { id: 'float', label: '浮点', color: '#06b6d4' },
  { id: 'bool', label: '布尔', color: '#f97316' },
  { id: 'seed', label: '种子值', color: '#f5c518' },
]

export const PrimitiveNode = memo(({ id, data }) => {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const valueType = data.valueType || 'string'
  const typeMeta = VALUE_TYPES.find(t => t.id === valueType)
  const isCollapsed = data.collapsed

  const handleValueChange = useCallback((e) => {
    let val = e.target.value
    if (valueType === 'int') val = parseInt(val) || 0
    if (valueType === 'float') val = parseFloat(val) || 0
    if (valueType === 'bool') val = e.target.value === 'true'
    if (valueType === 'seed') val = parseInt(val) || -1
    updateNodeData(id, { value: val })
  }, [id, valueType, updateNodeData])

  const displayValue = data.value !== undefined ? String(data.value) : ''

  return (
    <div className={'canvas-node' + (isCollapsed ? ' collapsed' : '')} style={{ borderColor: (typeMeta?.color || '#6c63ff') + '40', minWidth: 180, maxWidth: 240 }}>
      <div className="node-header-accent" style={{ background: 'linear-gradient(90deg, ' + (typeMeta?.color || '#6c63ff') + ', transparent)' }} />
      <div className="node-header">
        <span className="node-icon" style={{color: typeMeta?.color}}>#</span>
        <span className="node-title">{data.label || '基础值'}</span>
        <span className="node-status idle">{typeMeta?.label || 'string'}</span>
      </div>
      {!isCollapsed && <div className="node-body">
        <select value={valueType} onChange={(e) => updateNodeData(id, { valueType: e.target.value, value: '' })}
          className="node-select" style={{fontSize:11}}>
          {VALUE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        {valueType === 'bool' ? (
          <select value={data.value ? 'true' : 'false'}
            onChange={(e) => updateNodeData(id, { value: e.target.value === 'true' })}
            className="node-select" style={{fontSize:11}}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input value={displayValue} onChange={handleValueChange}
            placeholder={valueType === 'seed' ? '-1 = 随机' : '输入值...'}
            type={valueType === 'int' || valueType === 'float' || valueType === 'seed' ? 'number' : 'text'}
            className="node-textarea" style={{minHeight:32, fontSize:14, fontWeight:700, textAlign:'center', padding:'6px'}} />
        )}
      </div>}
      <Handle type="source" position={Position.Right} id="output"
        style={{ background: typeMeta?.color || '#6c63ff', border: '2px solid #1e1e32', width: 10, height: 10, top: '50%' }} />
      <div className="handle-label handle-label-right" style={{top:'50%',marginTop:-8}}>{typeMeta?.label || '值'}</div>
    </div>
  )
})
