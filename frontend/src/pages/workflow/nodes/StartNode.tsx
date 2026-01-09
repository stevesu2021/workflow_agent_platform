import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { PlayCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Popover, Descriptions } from 'antd';

export const StartNode = ({ data, selected }: NodeProps) => {
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
            border: selected ? '2px solid #1890ff' : '1px solid #1890ff',
            background: '#e6f7ff',
            color: '#1890ff',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: '120px',
            justifyContent: 'center',
            boxShadow: selected ? '0 0 0 2px rgba(24, 144, 255, 0.2)' : '0 2px 5px rgba(0,0,0,0.1)',
            position: 'relative'
        }}
        >
        <PlayCircleOutlined />
        开始
        
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
            style={{ background: '#1890ff' }}
            isConnectable={true}
        />
        </div>
    </Popover>
  );
};
