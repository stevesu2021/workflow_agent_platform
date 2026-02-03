import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { Tabs, Button, Modal, Form, Input, message, Dropdown } from 'antd';
import { SaveOutlined, ExportOutlined, DownOutlined } from '@ant-design/icons';
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
import { Sidebar } from './workflow/Sidebar';
import { DebugPanel } from './workflow/DebugPanel';
import { PropertyPanel } from './workflow/PropertyPanel';
import { StartNode } from './workflow/nodes/StartNode';
import { CommonNode } from './workflow/nodes/CommonNode';
import { EndNode } from './workflow/nodes/EndNode';
import { ForLoopNode } from './workflow/nodes/ForLoopNode';
import { CodeBlockNode } from './workflow/nodes/CodeBlockNode';
import { IntentNode } from './workflow/nodes/IntentNode';
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

// Define nodeTypes outside component to avoid recreation on each render
const nodeTypes = {
  start: StartNode,
  common: CommonNode,
  end: EndNode,
  for_loop: ForLoopNode,
  code_block: CodeBlockNode,
  intent: IntentNode,
};

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
  const [isSaveAsMode, setIsSaveAsMode] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveForm] = Form.useForm();

  // Store current agent data for save as
  const [currentAgentData, setCurrentAgentData] = useState<{ name: string; description: string } | null>(null);

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

        // Fetch agent details to get name for save as
        agentsApi.getAll().then(agents => {
            const currentAgent = agents.find(a => a.id === workflowId);
            if (currentAgent) {
                setCurrentAgentData({
                    name: currentAgent.name,
                    description: currentAgent.description || ''
                });
            }
        }).catch(err => {
            console.error("Failed to fetch agent details:", err);
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
                        ...restData,  // Spread restData first to preserve all fields
                        label: node.data.label,
                        // Explicitly set these fields, overriding restData if present
                        ...(node.data.model !== undefined && { model: node.data.model }),
                        ...(node.data.system_prompt !== undefined && { prompt: node.data.system_prompt }),
                        ...(node.data.temperature !== undefined && { temperature: Number(node.data.temperature) }),
                        ...(node.data.tool_name !== undefined && { tool_id: node.data.tool_name }),
                        ...(node.data.knowledge_base_id !== undefined && { knowledge_id: node.data.knowledge_base_id }),
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

        if (isSaveAsMode || !workflowId) {
            // Create new agent (Save As or first time save)
            const newAgent = await agentsApi.create({
                name: values.name,
                description: values.description,
                flow_json: flowJson
            });
            message.success(isSaveAsMode ? 'Agent saved as new successfully' : 'Agent created successfully');
            setIsSaveAsMode(false);
            navigate('/agents');
        } else {
            // Update existing agent directly (no modal for regular save)
            await agentsApi.update(workflowId, {
                name: currentAgentData?.name || values.name,
                description: currentAgentData?.description || values.description,
                flow_json: flowJson
            });
            message.success('Agent saved successfully');
        }

        setIsSaveModalOpen(false);
    } catch (error) {
        console.error(error);
        message.error('Failed to save agent');
    } finally {
        setSaveLoading(false);
    }
  };

  // Direct save (for editing existing agent, no modal)
  const handleDirectSave = async () => {
    if (!workflowId) {
        // New agent, open modal
        openSaveModal();
        return;
    }

    if (!reactFlowInstance) return;

    setSaveLoading(true);
    try {
        const flowObject = reactFlowInstance.toObject();
        const flowJson = {
            nodes: flowObject.nodes.map(node => {
                const { originalType, output_params, ...restData } = node.data || {};
                let backendType = node.type;
                if (node.type === 'common' && node.data?.originalType) {
                    backendType = node.data.originalType;
                }
                return {
                    id: node.id,
                    type: backendType,
                    position: node.position,
                    data: {
                        ...restData,  // Spread restData first to preserve all fields
                        label: node.data.label,
                        // Explicitly set these fields, overriding restData if present
                        ...(node.data.model !== undefined && { model: node.data.model }),
                        ...(node.data.system_prompt !== undefined && { prompt: node.data.system_prompt }),
                        ...(node.data.temperature !== undefined && { temperature: Number(node.data.temperature) }),
                        ...(node.data.tool_name !== undefined && { tool_id: node.data.tool_name }),
                        ...(node.data.knowledge_base_id !== undefined && { knowledge_id: node.data.knowledge_base_id }),
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

        await agentsApi.update(workflowId, {
            name: currentAgentData?.name || 'Untitled',
            description: currentAgentData?.description || '',
            flow_json: flowJson
        });
        message.success('Agent saved successfully');
    } catch (error) {
        console.error(error);
        message.error('Failed to save agent');
    } finally {
        setSaveLoading(false);
    }
  };

  const openSaveModal = () => {
      saveForm.setFieldsValue({
          name: '',
          description: ''
      });
      setIsSaveAsMode(false);
      setIsSaveModalOpen(true);
  };

  const openSaveAsModal = () => {
      saveForm.setFieldsValue({
          name: currentAgentData?.name + ' (Copy)' || '',
          description: currentAgentData?.description || ''
      });
      setIsSaveAsMode(true);
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
          case 'excel_parser':
              defaultOutputParams = [
                  { name: 'records', type: 'object[]', desc: '解析后的数据行列表' },
                  { name: 'headers', type: 'string[]', desc: 'Excel表头列表' },
                  { name: 'row_count', type: 'number', desc: '数据行数' }
              ];
              break;
          case 'output':
              defaultOutputParams = [
                  { name: 'output_text', type: 'string', desc: '拼接后的输出文本' }
              ];
              break;
          case 'for_loop':
              defaultOutputParams = [
                  { name: 'results_array', type: 'object[]', desc: '每次迭代结果组成的数组' },
                  { name: 'iteration_count', type: 'number', desc: '实际完成的迭代次数' }
              ];
              break;
          case 'code_block':
              // Code block has dynamic output params based on user code
              defaultOutputParams = [
                  { name: 'result', type: 'any', desc: '代码执行结果（用户自定义）' }
              ];
              break;
          case 'intent':
              defaultOutputParams = [
                  { name: 'intent', type: 'string', desc: '匹配到的意图标识符' },
                  { name: 'intent_name', type: 'string', desc: '意图可读名称' },
                  { name: 'confidence', type: 'number', desc: '匹配置信度 (0.0-1.0)' },
                  { name: 'slots', type: 'object', desc: '提取出的结构化参数' },
                  { name: 'matched_node_id', type: 'string', desc: '匹配到的下游目标节点ID' }
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
            <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleDirectSave}
                loading={saveLoading}
                style={{ marginRight: 8 }}
            >
                保存
            </Button>
            <Dropdown.Button
                icon={<DownOutlined />}
                onClick={handleDirectSave}
                menu={{
                    items: [
                        {
                            key: 'save-as',
                            label: '另存为...',
                            onClick: openSaveAsModal
                        }
                    ]
                }}
            >
                更多
            </Dropdown.Button>
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
