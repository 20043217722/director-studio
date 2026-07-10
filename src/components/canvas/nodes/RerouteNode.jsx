import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

export const RerouteNode = memo(({ data }) => {
  return (
    <div className="canvas-node reroute-node">
      <Handle type="target" position={Position.Left} id="input"
        style={{ background: '#6c63ff', border: '2px solid #1e1e32', width: 10, height: 10, top: '50%' }} />
      <div className="reroute-diamond" />
      <div className="reroute-tooltip">中继</div>
      <Handle type="source" position={Position.Right} id="output"
        style={{ background: '#6c63ff', border: '2px solid #1e1e32', width: 10, height: 10, top: '50%' }} />
    </div>
  )
})
