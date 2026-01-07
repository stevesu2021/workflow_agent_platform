import React from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { AppstoreOutlined } from '@ant-design/icons';

export const CommonNode = ({ data, selected }: NodeProps) => {
  return (
    <div
      style={{
        padding: '10px 15px',
        borderRadius: '8px',
        border: selected ? '2px solid #1890ff' : '1px solid #ddd',
        background: '#fff',
        color: '#333',
        minWidth: '150px',
        boxShadow: selected ? '0 0 0 2px rgba(24, 144, 255, 0.2)' : '0 2px 5px rgba(0,0,0,0.1)',
        textAlign: 'center'
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
      
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#555' }}
        isConnectable={true}
      />
    </div>
  );
};
