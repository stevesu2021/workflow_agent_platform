import React from 'react';
import { 
  RobotOutlined, 
  ReadOutlined, 
  ToolOutlined, 
  ApiOutlined, 
  FileTextOutlined, 
  EyeOutlined, 
  CompassOutlined 
} from '@ant-design/icons';
import { Typography, Card, Space } from 'antd';

const { Text, Title } = Typography;

export const Sidebar = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const nodeTypes = [
    { type: 'llm', label: '大模型', icon: <RobotOutlined />, color: '#1890ff', bg: '#e6f7ff' },
    { type: 'knowledge', label: '知识库', icon: <ReadOutlined />, color: '#52c41a', bg: '#f6ffed' },
    { type: 'tool', label: '工具调用', icon: <ToolOutlined />, color: '#fa8c16', bg: '#fff7e6' },
    { type: 'mcp', label: 'MCP服务', icon: <ApiOutlined />, color: '#722ed1', bg: '#f9f0ff' },
    { type: 'doc_parser', label: '文档解析', icon: <FileTextOutlined />, color: '#13c2c2', bg: '#e6fffb' },
    { type: 'vision', label: '视觉理解', icon: <EyeOutlined />, color: '#eb2f96', bg: '#fff0f6' },
    { type: 'intent', label: '意图识别', icon: <CompassOutlined />, color: '#faad14', bg: '#fffbe6' },
  ];

  return (
    <aside style={{ 
      width: '240px', 
      padding: '16px', 
      borderRight: '1px solid #f0f0f0', 
      background: '#fafafa', 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <Title level={5} style={{ margin: 0 }}>组件库</Title>
        <Text type="secondary" style={{ fontSize: '12px' }}>拖拽组件到右侧画布构建流程</Text>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {nodeTypes.map((node) => (
          <div
            key={node.type}
            onDragStart={(event) => onDragStart(event, node.type, node.label)}
            draggable
            style={{
              padding: '12px',
              border: '1px solid #e8e8e8',
              borderRadius: '8px',
              cursor: 'grab',
              backgroundColor: '#fff',
              userSelect: 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = node.color;
              e.currentTarget.style.boxShadow = `0 2px 8px ${node.color}20`;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e8e8e8';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '6px', 
              backgroundColor: node.bg, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: node.color,
              fontSize: '16px'
            }}>
              {node.icon}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Text strong style={{ fontSize: '14px' }}>{node.label}</Text>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
