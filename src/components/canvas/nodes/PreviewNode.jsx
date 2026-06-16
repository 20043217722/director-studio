import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

export const PreviewNode = memo(({ data }) => {
  return (
    <div className="canvas-node" style={{ minWidth: 240, maxWidth: 400 }}>
      <Handle type="target" position={Position.Left} id="input"
        style={{ background: 'var(--brand)', border: '2px solid var(--bg-surface)', width: 12, height: 12 }} />

      <div className="node-header" style={{ borderLeftColor: 'var(--brand)' }}>
        <span>👁️ {data.label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {data.status === 'generating' ? '生成中...' : data.status === 'error' ? '错误' : data.outputContent ? '就绪' : '等待输入'}
        </span>
      </div>

      <div className="node-body">
        {data.status === 'generating' && (
          <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)' }}>
            <div className="loading-dot" style={{ display: 'inline-block', margin: '0 2px' }} />
            <div className="loading-dot" style={{ display: 'inline-block', margin: '0 2px', animationDelay: '0.2s' }} />
            <div className="loading-dot" style={{ display: 'inline-block', margin: '0 2px', animationDelay: '0.4s' }} />
          </div>
        )}

        {data.outputType === 'image' && data.outputContent && (
          <img src={typeof data.outputContent === 'string' ? data.outputContent : data.outputContent.url}
            alt="Generated" style={{ width: '100%', borderRadius: 4, maxHeight: 300, objectFit: 'contain' }} />
        )}

        {data.outputType === 'video' && data.outputContent?.url && (
          <video src={data.outputContent.url} controls
            style={{ width: '100%', borderRadius: 4, maxHeight: 240 }} />
        )}

        {data.status === 'error' && (
          <div className="node-error">{data.errorMessage}</div>
        )}

        {!data.outputContent && data.status !== 'generating' && data.status !== 'error' && (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            连接生成节点<br/>查看输出结果
          </div>
        )}

        {data.outputContent && (
          <a href={typeof data.outputContent === 'string' ? data.outputContent : data.outputContent.url}
            download target="_blank" rel="noreferrer"
            style={{
              display: 'block', textAlign: 'center', marginTop: 8,
              fontSize: 11, color: 'var(--accent)', textDecoration: 'none',
            }}>
            ⬇ 下载
          </a>
        )}
      </div>
    </div>
  )
})
