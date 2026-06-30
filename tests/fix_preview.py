import re

with open('D:/导演工作室/src/components/canvas/nodes/PreviewNode.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import for useCanvasStore
content = content.replace(
    "import { memo, useState } from 'react'",
    "import { memo, useState, useCallback } from 'react'\nimport { useCanvasStore } from '../utils/canvasStore'"
)

# Find PreviewNode component and add id to props
# The component is: export const PreviewNode = memo(({ data }) => {
# Change to: export const PreviewNode = memo(({ id, data }) => {
content = content.replace(
    "export const PreviewNode = memo(({ data }) => {",
    "export const PreviewNode = memo(({ id, data }) => {"
)

# Add feedback buttons before the closing </div> of node-body
# Find: the empty state closing and the next </div>
old = '''            <span>连接生成节点，数据自动流转</span>
          </div>
        )}
      </div>'''

new = '''            <span>连接生成节点，数据自动流转</span>
          </div>
        )}

        {/* Feedback action buttons — creator quick actions */}
        {hasContent && data.status !== 'generating' && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.dispatchEvent(new CustomEvent('preview-retry', { detail: { previewId: id } }))
              }}
              title="触发上游节点重新生成"
              style={{
                flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600,
                borderRadius: 4, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >🔄 重新生成</button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const s = useCanvasStore.getState()
                const upstreamIds = s.edges.filter(edge => edge.target === id).map(edge => edge.source)
                const upstreamNode = upstreamIds.length > 0 ? s.nodes.find(n => n.id === upstreamIds[0]) : null
                const pos = {
                  x: upstreamNode ? upstreamNode.position.x + 360 : 300,
                  y: upstreamNode ? upstreamNode.position.y - 80 : 200,
                }
                s.addNode('agent', pos)
                const newNode = s.nodes[s.nodes.length - 1]
                if (newNode) {
                  s.updateNodeData(newNode.id, {
                    agentMode: 'lens',
                    prompt: '分析这张生成结果，指出画面问题和改进方向，输出优化后的提示词',
                  })
                  const now = Date.now()
                  s.setState({
                    edges: [...s.edges, {
                      id: 'e_pv_analysis_' + now,
                      source: id, sourceHandle: 'output',
                      target: newNode.id, targetHandle: 'prompt',
                      type: 'smoothstep', animated: true,
                      style: { stroke: 'var(--brand)', strokeWidth: 3, strokeLinecap: 'round' },
                    }],
                  })
                }
              }}
              title="创建视觉解析师分析生成结果"
              style={{
                flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600,
                borderRadius: 4, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >🔍 智能体分析</button>
          </div>
        )}
      </div>'''

if old in content:
    content = content.replace(old, new)
    print('Replaced successfully')
else:
    print('Old string not found')
    idx = content.find('连接生成节点')
    if idx > 0:
        print('Found nearby:', repr(content[idx-50:idx+100]))
    else:
        print('Could not find target text')

with open('D:/导演工作室/src/components/canvas/nodes/PreviewNode.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
