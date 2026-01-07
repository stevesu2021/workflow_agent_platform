import React from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { StopOutlined } from '@ant-design/icons';

export const EndNode = ({ selected }: NodeProps) => {
  return (
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
        boxShadow: selected ? '0 0 0 2px rgba(255, 77, 79, 0.2)' : '0 2px 5px rgba(0,0,0,0.1)'
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
    </div>
  );
};
