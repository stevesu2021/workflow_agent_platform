import React from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { PlayCircleOutlined } from '@ant-design/icons';

export const StartNode = ({ selected }: NodeProps) => {
  return (
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
        boxShadow: selected ? '0 0 0 2px rgba(24, 144, 255, 0.2)' : '0 2px 5px rgba(0,0,0,0.1)'
      }}
    >
      <PlayCircleOutlined />
      开始
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#1890ff' }}
        isConnectable={true}
      />
    </div>
  );
};
