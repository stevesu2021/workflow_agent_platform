import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { AppstoreOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Popover, Typography, Descriptions } from 'antd';

export const CommonNode = ({ data, selected }: NodeProps) => {
  const [open, setOpen] = useState(false);
  const debugData = data._debugData;

  const content = (
      <div style={{ maxWidth: 300, maxHeight: 300, overflow: 'auto' }}>
          <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Timestamp">{debugData?.timestamp}</Descriptions.Item>
              <Descriptions.Item label="Input">
                  <pre style={{ fontSize: 10, margin: 0 }}>
                      {JSON.stringify(debugData?.inputs, null, 2)}
                  </pre>
              </Descriptions.Item>
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
            padding: '10px 15px',
            borderRadius: '8px',
            border: selected ? '2px solid #1890ff' : '1px solid #ddd',
            background: '#fff',
            color: '#333',
            minWidth: '150px',
            boxShadow: selected ? '0 0 0 2px rgba(24, 144, 255, 0.2)' : '0 2px 5px rgba(0,0,0,0.1)',
            textAlign: 'center',
            position: 'relative'
        }}
        >
        <Handle
            type="target"
            position={Position.Top}
            style={{ background: '#555' }}
            isConnectable={true}
        />
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
            <AppstoreOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontWeight: 'bold' }}>{data.label}</span>
        </div>
        
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
        
        <Handle
            type="source"
            position={Position.Bottom}
            style={{ background: '#555' }}
            isConnectable={true}
        />
        </div>
    </Popover>
  );
};
