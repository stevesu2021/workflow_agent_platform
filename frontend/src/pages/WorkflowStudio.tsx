import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
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
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Button, Modal, Form, Input, message } from 'antd';
import { SaveOutlined, ExportOutlined } from '@ant-design/icons';
import { Sidebar } from './workflow/Sidebar';
import { DebugPanel } from './workflow/DebugPanel';
import { PropertyPanel } from './workflow/PropertyPanel';
import { StartNode } from './workflow/nodes/StartNode';
import { CommonNode } from './workflow/nodes/CommonNode';
import { EndNode } from './workflow/nodes/EndNode';
import { agentsApi } from '../api/agents';

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
  const navigate = useNavigate();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  // Save modal state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveForm] = Form.useForm();

  // Load agent data if editing
  useEffect(() => {
    if (workflowId) {
        setSaveLoading(true);
        // Fetch flow JSON directly to restore canvas
        agentsApi.getFlow(workflowId).then(flowJson => {
            if (flowJson && flowJson.nodes && flowJson.edges) {
                setNodes(flowJson.nodes.map((node: any) => ({
                    ...node,
                    // Ensure 'common' type is set for UI if it's one of the tool types
                    type: ['start', 'end'].includes(node.type) ? node.type : 'common',
                    data: {
                        ...node.data,
                        originalType: node.type // Restore original type
                    }
                })));
                setEdges(flowJson.edges);
            }
        }).catch(err => {
            console.error("Failed to load agent flow:", err);
            message.error("Failed to load agent workflow");
        }).finally(() => {
            setSaveLoading(false);
        });
    }
  }, [workflowId, setNodes, setEdges]);
  
  const handleSave = async (values: { name: string; description?: string }) => {
    if (!reactFlowInstance) return;

    setSaveLoading(true);
    try {
        const flowObject = reactFlowInstance.toObject();
        // react-flow's toObject() returns { nodes, edges, viewport }
        // Our backend expects { nodes, edges } for flow_json
        
        // Ensure flow_json matches AgentGraph schema (nodes, edges)
        // Clean node data to match NodeData schema
        const flowJson = {
            nodes: flowObject.nodes.map(node => {
                // Ensure data fields match NodeData schema
                const { originalType, output_params, ...restData } = node.data || {};
                
                // Map frontend fields to backend NodeData schema
                // Frontend uses 'originalType' sometimes, but backend expects type in Node.type (which is already mapped)
                // Backend NodeData allows extra fields (Config.extra = "allow"), but we should be careful.
                
                // Determine the correct backend type
                // Frontend uses 'common' for drag-and-drop nodes, but backend requires specific types like 'llm', 'tool', etc.
                // We stored the specific type in 'originalType' or 'type' (if not common)
                let backendType = node.type;
                if (node.type === 'common' && node.data?.originalType) {
                    backendType = node.data.originalType;
                }
                
                return {
                    id: node.id,
                    type: backendType, // 'start', 'end', 'llm', 'tool', etc.
                    position: node.position,
                    data: {
                        label: node.data.label,
                        // Pass through other known fields
                        model: node.data.model,
                        prompt: node.data.system_prompt, // Frontend uses system_prompt, backend uses prompt? Let's check schema.
                        temperature: node.data.temperature ? Number(node.data.temperature) : 0.7,
                        tool_id: node.data.tool_name, // Frontend uses tool_name?
                        knowledge_id: node.data.knowledge_base_id,
                        // Keep original data for frontend restoration if needed, 
                        // but be aware that backend validation might fail if type mismatches.
                        ...restData,
                        // Explicitly include output_params as it's used in frontend
                        output_params: output_params
                    }
                };
            }),
            edges: flowObject.edges.map(edge => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.label,
                ...(edge.data ? { data: edge.data } : {})
            }))
        };
        
        if (workflowId) {
             // Update existing
             await agentsApi.update(workflowId, {
                 name: values.name,
                 description: values.description,
                 // Also update the flow
                 flow_json: flowJson
             });
             message.success('Agent updated successfully');
             navigate('/agents');
        } else {
            // Create new
            const newAgent = await agentsApi.create({
                name: values.name,
                description: values.description,
                flow_json: flowJson
            });
            message.success('Agent created successfully');
            navigate('/agents');
        }
        
        setIsSaveModalOpen(false);
    } catch (error) {
        console.error(error);
        message.error('Failed to save agent');
    } finally {
        setSaveLoading(false);
    }
  };

  const openSaveModal = () => {
      saveForm.setFieldsValue({
          name: '', // You might want to pre-fill if editing
          description: ''
      });
      setIsSaveModalOpen(true);
  };

  const handleExportYaml = async () => {
    if (!workflowId) {
        message.warning('Please save the workflow first to export.');
        return;
    }
    
    try {
        const { yaml, filename } = await agentsApi.exportYaml(workflowId);
        
        // Create a download link
        const blob = new Blob([yaml], { type: 'text/yaml' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        message.success('Exported successfully');
    } catch (error) {
        console.error('Export failed:', error);
        message.error('Failed to export YAML');
    }
  };

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
      let defaultSystemPrompt = undefined;

      switch (type) {
          case 'llm':
              defaultOutputParams = [
                  { name: 'text', type: 'string', desc: '模型生成的文本内容' },
                  { name: 'usage', type: 'object', desc: 'Token使用情况' }
              ];
              defaultSystemPrompt = "你是电网专家，熟悉电力系统、输配电、智能电网、继电保护、调度自动化、新能源并网等相关领域，能够提供专业、准确、安全的技术支持与解答。";
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
            output_params: defaultOutputParams,
            system_prompt: defaultSystemPrompt 
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

  // Debug Trace Logs
  const [lastTraceLogs, setLastTraceLogs] = useState<any[]>([]);

  const handleDebugRunComplete = (logs: any[]) => {
      setLastTraceLogs(logs);
      // Update nodes data with latest trace info
      setNodes((nds) => 
        nds.map(node => {
            const nodeLog = logs.find(l => l.node_id === node.id);
            if (nodeLog) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        _debugData: nodeLog
                    }
                };
            }
            return node;
        })
      );
  };

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
          <div>
            {workflowId && (
                <Button icon={<ExportOutlined />} onClick={handleExportYaml} style={{ marginRight: 8 }}>
                    导出 YAML
                </Button>
            )}
            <Button type="primary" icon={<SaveOutlined />} onClick={openSaveModal}>
                保存
            </Button>
          </div>
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
            {activeKey === 'debug' && <DebugPanel nodes={nodes} onRunComplete={handleDebugRunComplete} />}
        </div>
      </div>
      <Modal
        title={workflowId ? "Update Agent" : "Save New Agent"}
        open={isSaveModalOpen}
        onOk={saveForm.submit}
        onCancel={() => setIsSaveModalOpen(false)}
        confirmLoading={saveLoading}
      >
          <Form
            form={saveForm}
            layout="vertical"
            onFinish={handleSave}
          >
              <Form.Item
                name="name"
                label="Agent Name"
                rules={[{ required: true, message: 'Please input the agent name!' }]}
              >
                  <Input placeholder="Enter agent name" />
              </Form.Item>
              <Form.Item
                name="description"
                label="Description"
              >
                  <Input.TextArea rows={3} placeholder="Enter agent description" />
              </Form.Item>
          </Form>
      </Modal>
    </div>
  );
};

const WorkflowStudio = () => (
  <ReactFlowProvider>
    <WorkflowStudioContent />
  </ReactFlowProvider>
);

export default WorkflowStudio;
