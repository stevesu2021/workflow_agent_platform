import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { CodeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Popover, Descriptions, Typography } from 'antd';

const { Text } = Typography;

export const CodeBlockNode = ({ data, selected }: NodeProps) => {
  const [open, setOpen] = useState(false);
  const debugData = data._debugData;

  // Get a preview of the code (first 100 chars)
  const codePreview = data.code ? data.code.substring(0, 100) + (data.code.length > 100 ? '...' : '') : '# No code';

  const content = (
      <div style={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
          <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Timestamp">{debugData?.timestamp}</Descriptions.Item>
              <Descriptions.Item label="Inputs">
                  <pre style={{ fontSize: 10, margin: 0 }}>
                      {JSON.stringify(debugData?.inputs, null, 2)}
                  </pre>
              </Descriptions.Item>
              <Descriptions.Item label="Output">
                  <pre style={{ fontSize: 10, margin: 0 }}>
                      {JSON.stringify(debugData?.output, null, 2)}
                  </pre>
              </Descriptions.Item>
              {debugData?.error && (
                  <Descriptions.Item label="Error">
                      <pre style={{ fontSize: 10, margin: 0, color: 'red' }}>
                          {debugData.error}
                      </pre>
                  </Descriptions.Item>
              )}
          </Descriptions>
      </div>
  );

  return (
    <Popover
        content={content}
        title="Python Code Block - Last Run"
        trigger="click"
        open={open}
        onOpenChange={setOpen}
    >
        <div
            style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: selected ? '2px solid #fa541c' : '1px solid #fa541c',
                background: '#fff2e8',
                color: '#fa541c',
                minWidth: '180px',
                position: 'relative',
                boxShadow: selected ? '0 0 0 2px rgba(250, 84, 28, 0.2)' : '0 2px 5px rgba(0,0,0,0.1)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <CodeOutlined style={{ fontSize: '16px' }} />
                <Text strong style={{ fontSize: '14px', color: '#fa541c' }}>
                    {data.label || 'Python 代码块'}
                </Text>
            </div>

            {/* Code preview */}
            <div
                style={{
                    marginTop: '8px',
                    padding: '8px',
                    background: '#fff',
                    borderRadius: '4px',
                    border: '1px solid #ffd8bf',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#666',
                    maxHeight: '60px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}
            >
                {codePreview}
            </div>

            {/* Debug indicator */}
            {debugData && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: -10,
                        right: -10,
                        background: debugData.error ? '#ff4d4f' : '#52c41a',
                        color: '#fff',
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: 12
                    }}
                >
                    <InfoCircleOutlined />
                </div>
            )}

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                style={{ background: '#fa541c' }}
                isConnectable={true}
            />

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                style={{ background: '#fa541c' }}
                isConnectable={true}
            />
        </div>
    </Popover>
  );
};
