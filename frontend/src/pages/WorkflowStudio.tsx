import React, { useCallback, useRef, useState, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
} from 'reactflow';
import type { Connection, Edge, Node, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { useParams } from 'react-router-dom';
import { Tabs } from 'antd';
import { Sidebar } from './workflow/Sidebar';
import { DebugPanel } from './workflow/DebugPanel';
import { PropertyPanel } from './workflow/PropertyPanel';
import { StartNode } from './workflow/nodes/StartNode';
import { CommonNode } from './workflow/nodes/CommonNode';
import { EndNode } from './workflow/nodes/EndNode';

const initialNodes: Node[] = [
  { 
    id: 'start-node', 
    type: 'start', 
    position: { x: 250, y: 50 }, 
    data: { 
      label: 'Start',
      output_params: [
        { name: 'rawQuery', type: 'string', desc: '用户输入的文本' },
        { name: 'fileNames', type: 'string[]', desc: '用户上传的文件名列表' },
        { name: 'fileUrls', type: 'string[]', desc: '文件MinIO路径列表' },
        { name: 'request_id', type: 'string', desc: '本次请求ID' },
        { name: 'conversion_id', type: 'string', desc: '会话ID' },
      ]
    } 
  },
  { id: 'end-node', type: 'end', position: { x: 250, y: 400 }, data: { label: 'End' } },
];

let id = 0;
const getId = () => `node_${id++}`;

const WorkflowStudioContent: React.FC = () => {
  const { id: workflowId } = useParams();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const nodeTypes = useMemo(() => ({
    start: StartNode,
    common: CommonNode,
    end: EndNode,
  }), []);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow/label');

      // check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      // Default output params based on node type
      let defaultOutputParams: any[] = [];
      switch (type) {
          case 'llm':
              defaultOutputParams = [
                  { name: 'text', type: 'string', desc: '模型生成的文本内容' },
                  { name: 'usage', type: 'object', desc: 'Token使用情况' }
              ];
              break;
          case 'knowledge':
              defaultOutputParams = [
                  { name: 'chunks', type: 'object[]', desc: '检索到的知识片段' }
              ];
              break;
          case 'tool':
              defaultOutputParams = [
                  { name: 'result', type: 'string', desc: '工具执行结果' }
              ];
              break;
          case 'doc_parser':
              defaultOutputParams = [
                  { name: 'content', type: 'string', desc: '解析后的文本内容' }
              ];
              break;
          default:
              break;
      }

      // project was renamed to screenToFlowPosition in v11.3.0+
      const position = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }) || { x: 0, y: 0 };
      
      const newNode: Node = {
        id: getId(),
        type: 'common', // Use 'common' type for all dragged tools for now
        position,
        data: { 
            label: `${label}`, 
            originalType: type,
            output_params: defaultOutputParams 
        }, 
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
      setSelectedNode(null);
  }, []);

  const onNodeUpdate = useCallback((id: string, data: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: { ...node.data, ...data },
            };
          }
          return node;
        })
      );
  }, [setNodes]);

  const [activeKey, setActiveKey] = useState('planning');

  const items = [
    {
      key: 'planning',
      label: '规划',
    },
    {
      key: 'debug',
      label: '调试',
    },
  ];

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 120px)' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>{workflowId ? `Editing Agent Workflow: ${workflowId}` : 'New Agent Workflow'}</h3>
      </div>
      
      <div style={{ height: '100%', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <Tabs 
            activeKey={activeKey} 
            onChange={setActiveKey}
            items={items} 
            tabBarStyle={{ paddingLeft: '16px', marginBottom: 0 }}
        />
        <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ display: activeKey === 'planning' ? 'flex' : 'none', height: '100%', width: '100%', position: 'relative' }}>
                <Sidebar />
                <div className="reactflow-wrapper" ref={reactFlowWrapper} style={{ flex: 1, height: '100%' }}>
                    <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    fitView
                    deleteKeyCode={['Backspace', 'Delete']}
                    >
                    <Controls />
                    <MiniMap />
                    <Background gap={12} size={1} />
                    </ReactFlow>
                </div>
                <PropertyPanel 
                    node={selectedNode} 
                    nodes={nodes}
                    edges={edges}
                    isOpen={!!selectedNode} 
                    onClose={() => setSelectedNode(null)}
                    onUpdate={onNodeUpdate}
                />
            </div>
            {activeKey === 'debug' && <DebugPanel nodes={nodes} />}
        </div>
      </div>
    </div>
  );
};

const WorkflowStudio = () => (
  <ReactFlowProvider>
    <WorkflowStudioContent />
  </ReactFlowProvider>
);

export default WorkflowStudio;
