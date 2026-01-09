import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { StopOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Popover, Descriptions } from 'antd';

export const EndNode = ({ data, selected }: NodeProps) => {
  const [open, setOpen] = useState(false);
  const debugData = data._debugData;

  const content = (
      <div style={{ maxWidth: 300, maxHeight: 200, overflow: 'auto' }}>
          <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Timestamp">{debugData?.timestamp}</Descriptions.Item>
              <Descriptions.Item label="Output">
                  <pre style={{ fontSize: 10, margin: 0 }}>
                      {JSON.stringify(debugData?.output, null, 2)}
                  </pre>
              </Descriptions.Item>
          </Descriptions>
      </div>
  );

  return (
    <Popover 
        content={content} 
        title="Last Run Output" 
        trigger="click"
        open={open}
        onOpenChange={setOpen}
    >
        <div
        style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: selected ? '2px solid #ff4d4f' : '1px solid #ff4d4f',
            background: '#fff1f0',
            color: '#ff4d4f',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: '120px',
            justifyContent: 'center',
            boxShadow: selected ? '0 0 0 2px rgba(255, 77, 79, 0.2)' : '0 2px 5px rgba(0,0,0,0.1)',
            position: 'relative'
        }}
        >
        <Handle
            type="target"
            position={Position.Top}
            style={{ background: '#ff4d4f' }}
            isConnectable={true}
        />
        <StopOutlined />
        结束
        
        {debugData && (
            <div style={{ 
                position: 'absolute', 
                bottom: -10, 
                right: -10, 
                background: '#52c41a', 
                color: '#fff', 
                borderRadius: '50%', 
                width: 20, 
                height: 20, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 12
            }}>
                <InfoCircleOutlined />
            </div>
        )}
        </div>
    </Popover>
  );
};
