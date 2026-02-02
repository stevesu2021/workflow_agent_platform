import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Card } from 'antd';

// Data structure for for_loop node:
// data: {
//   array_input: string,      // 变量引用，如 {{vars.user_list}}
//   item_alias: string,        // 当前项别名，默认 "item"
//   max_iterations: number,    // 最大迭代次数，默认 50
//   on_error: 'skip' | 'stop'  // 错误处理方式
// }

export const ForLoopNode = ({ data, id, selected }: NodeProps) => {
  return (
    <div
      style={{
        padding: '16px',
        minWidth: '300px',
        minHeight: '200px',
        border: '2px dashed #999',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
        position: 'relative',
        boxShadow: selected ? '0 0 0 2px #1890ff' : '0 1px 2px rgba(0,0,0,0.1)',
      }}
    >
      {/* Label at the top */}
      <div
        style={{
          position: 'absolute',
          top: '-12px',
          left: '16px',
          backgroundColor: '#fff',
          padding: '0 8px',
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#666',
          border: '1px solid #ddd',
          borderRadius: '4px',
        }}
      >
        🔁 For Loop: {data.label || id}
      </div>

      {/* Loop description */}
      <div
        style={{
          marginTop: '8px',
          marginBottom: '8px',
          fontSize: '11px',
          color: '#999',
          fontFamily: 'monospace',
        }}
      >
        for {data.item_alias || 'item'} in {data.array_input || '[]'}
      </div>

      {/* Drop zone indicator */}
      <div
        style={{
          marginTop: '20px',
          padding: '20px',
          border: '1px dashed #ccc',
          borderRadius: '4px',
          textAlign: 'center',
          color: '#aaa',
          fontSize: '12px',
        }}
      >
        拖拽节点到此处作为循环体
      </div>

      {/* Output handle at the bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        style={{ bottom: -8, left: '50%', transform: 'translateX(-50%)' }}
      />
    </div>
  );
};
