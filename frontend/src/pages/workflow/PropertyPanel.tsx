import React, { useEffect, useMemo, useState } from 'react';
import { Form, Input, Select, Drawer, Typography, Divider, Collapse, Button } from 'antd';
import type { Node, Edge } from 'reactflow';
import { knowledgeApi } from '../../api/knowledge';
import { aiResourcesApi } from '../../api/aiResources';
import type { KnowledgeBase } from '../../types/knowledge';
import type { AiResource } from '../../types/aiResource';

interface PropertyPanelProps {
  node: Node | null;
  nodes?: Node[];
  edges?: Edge[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: any) => void;
}

const { Option } = Select;
const { Text, Title } = Typography;

export const PropertyPanel: React.FC<PropertyPanelProps> = ({ node, nodes = [], edges = [], isOpen, onClose, onUpdate }) => {
  const [form] = Form.useForm();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [llmModels, setLlmModels] = useState<AiResource[]>([]);
  const [ocrModels, setOcrModels] = useState<AiResource[]>([]);

  useEffect(() => {
    if (node) {
      form.setFieldsValue({
        label: node.data.label,
        ...node.data
      });

      // Fetch knowledge bases if the node type is 'knowledge'
      if (node.data.originalType === 'knowledge' || node.type === 'knowledge') {
          knowledgeApi.list().then(data => {
              setKnowledgeBases(data);
          }).catch(err => {
              console.error("Failed to fetch knowledge bases:", err);
          });
      }

      // Fetch LLM models if the node type is 'llm'
      if (node.data.originalType === 'llm' || node.type === 'llm') {
          aiResourcesApi.getAvailable('text_llm').then(response => {
              const models = response.data;
              setLlmModels(models);
              
              // Set default model if not already set
              if (!node.data.model) {
                  const defaultModel = models.find((m: AiResource) => m.is_default);
                  if (defaultModel) {
                      form.setFieldValue('model', defaultModel.id);
                      // Trigger update to save the default value
                      onUpdate(node.id, { ...node.data, model: defaultModel.id });
                  } else if (models.length > 0) {
                      // Fallback to first available model
                       form.setFieldValue('model', models[0].id);
                       onUpdate(node.id, { ...node.data, model: models[0].id });
                  }
              }
          }).catch(err => {
              console.error("Failed to fetch LLM models:", err);
          });
      }

      // Fetch OCR models if the node type is 'doc_parser'
      if (node.data.originalType === 'doc_parser' || node.type === 'doc_parser') {
        // Fetch PaddleOCR
        const p1 = aiResourcesApi.getAvailable('ocr_paddle');
        // Fetch DeepSeek-OCR (assuming type is 'ocr_deepseek')
        const p2 = aiResourcesApi.getAvailable('ocr_deepseek');

        Promise.all([p1, p2]).then(([res1, res2]) => {
            const models = [...res1.data, ...res2.data];
            setOcrModels(models);

            // Set default model if not already set
            if (!node.data.parse_mode) {
                // Priority: Default PaddleOCR -> Default DeepSeek -> First available Paddle -> First available DeepSeek
                const defaultPaddle = models.find((m: AiResource) => m.type === 'ocr_paddle' && m.is_default);
                const defaultDeepseek = models.find((m: AiResource) => m.type === 'ocr_deepseek' && m.is_default);
                
                const targetModel = defaultPaddle || defaultDeepseek || models[0];

                if (targetModel) {
                    form.setFieldValue('parse_mode', targetModel.id);
                    onUpdate(node.id, { ...node.data, parse_mode: targetModel.id });
                }
            }
        }).catch(err => {
            console.error("Failed to fetch OCR models:", err);
        });
      }
    }
  }, [node, form]);

  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (node) {
      onUpdate(node.id, allValues);
    }
  };

  const upstreamVariables = useMemo(() => {
    if (!node || !nodes || !edges) return [];

    // Helper to find all reachable upstream nodes using BFS/DFS
    const findAllUpstreamNodes = (targetNodeId: string, visited = new Set<string>()): Node[] => {
        if (visited.has(targetNodeId)) return [];
        visited.add(targetNodeId);

        const directUpstreamEdges = edges.filter(edge => edge.target === targetNodeId);
        const directUpstreamNodes = directUpstreamEdges
            .map(edge => nodes.find(n => n.id === edge.source))
            .filter(Boolean) as Node[];

        let allNodes = [...directUpstreamNodes];
        directUpstreamNodes.forEach(upstreamNode => {
            allNodes = [...allNodes, ...findAllUpstreamNodes(upstreamNode.id, visited)];
        });

        return allNodes;
    };

    const allUpstreamNodes = findAllUpstreamNodes(node.id);
    // Remove duplicates based on ID
    const uniqueUpstreamNodes = Array.from(new Map(allUpstreamNodes.map(n => [n.id, n])).values());
    
    const variables: { label: string; value: string; type: string }[] = [];
    
    uniqueUpstreamNodes.forEach(upNode => {
      if (upNode.data.output_params && Array.isArray(upNode.data.output_params)) {
        upNode.data.output_params.forEach((param: any) => {
          variables.push({
            label: `${upNode.data.label || upNode.id}.${param.name}`,
            value: `${upNode.id}.output.${param.name}`,
            type: param.type
          });
        });
      }
    });
    
    return variables;
  }, [node, nodes, edges]);

  if (!node) return null;

  const nodeType = node.data.originalType || node.type;

  // Render Input Parameters Section
  const renderInputParams = () => {
    if (nodeType === 'start') {
       return <div style={{ color: '#999', fontSize: '12px' }}>该节点无输入参数</div>;
    }

    // Common input params renderer for all nodes (except start)
    return (
        <Form.List name="input_params">
            {(fields, { add, remove }) => (
                <>
                    {fields.map(({ key, name, ...restField }) => (
                        <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                            <Form.Item
                                {...restField}
                                name={[name, 'name']}
                                style={{ marginBottom: 0, flex: 1 }}
                            >
                                <Input placeholder="变量名称" />
                            </Form.Item>
                            <Form.Item
                                {...restField}
                                name={[name, 'value_source']}
                                style={{ marginBottom: 0, flex: 1.5 }}
                            >
                                <Select placeholder="选择来源变量">
                                    {upstreamVariables.map(variable => (
                                        <Option key={variable.value} value={variable.value}>
                                            {variable.label}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            <Typography.Link type="danger" onClick={() => remove(name)}>
                                删除
                            </Typography.Link>
                        </div>
                    ))}
                    <Form.Item>
                        <Button type="dashed" onClick={() => add()} block>
                            + 添加输入参数
                        </Button>
                    </Form.Item>
                    <div style={{ color: '#999', fontSize: '12px' }}>
                        * 引用上游节点的输出作为输入
                    </div>
                </>
            )}
        </Form.List>
    );
  };

  // Render Output Parameters Section
  const renderOutputParams = () => {
      if (nodeType === 'end') {
          return <div style={{ color: '#999', fontSize: '12px' }}>该节点无输出参数</div>;
      }
      
      // For start node and system nodes (llm, knowledge, tool, doc_parser), render read-only output params
      const systemNodes = ['start', 'llm', 'knowledge', 'tool', 'doc_parser'];
      if (systemNodes.includes(nodeType)) {
          return (
            <Form.List name="output_params">
                {(fields) => (
                    <>
                        {fields.map(({ key, name, ...restField }) => (
                            <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <Form.Item
                                    {...restField}
                                    name={[name, 'name']}
                                    style={{ marginBottom: 0, flex: 1 }}
                                >
                                    <Input placeholder="参数名" disabled />
                                </Form.Item>
                                 <Form.Item
                                    {...restField}
                                    name={[name, 'type']}
                                    style={{ marginBottom: 0, width: '100px' }}
                                >
                                    <Select placeholder="类型" disabled>
                                        <Option value="string">String</Option>
                                        <Option value="number">Number</Option>
                                        <Option value="boolean">Boolean</Option>
                                        <Option value="object">Object</Option>
                                        <Option value="string[]">String[]</Option>
                                        <Option value="object[]">Object[]</Option>
                                    </Select>
                                </Form.Item>
                            </div>
                        ))}
                        <div style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>
                            * 该类型组件的输出参数为系统预设，不可修改
                        </div>
                    </>
                )}
            </Form.List>
          );
      }

      return (
          <Form.List name="output_params">
            {(fields, { add, remove }) => (
                <>
                    {fields.map(({ key, name, ...restField }) => (
                        <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <Form.Item
                                {...restField}
                                name={[name, 'name']}
                                style={{ marginBottom: 0, flex: 1 }}
                            >
                                <Input placeholder="参数名" />
                            </Form.Item>
                             <Form.Item
                                {...restField}
                                name={[name, 'type']}
                                style={{ marginBottom: 0, width: '100px' }}
                            >
                                <Select placeholder="类型">
                                    <Option value="string">String</Option>
                                    <Option value="number">Number</Option>
                                    <Option value="boolean">Boolean</Option>
                                </Select>
                            </Form.Item>
                        </div>
                    ))}
                    <div style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>
                        * 定义该节点输出给下游的数据结构
                    </div>
                </>
            )}
        </Form.List>
      );
  };

  // Render System Parameters Section (Model config, etc.)
  const renderSystemParams = () => {
    switch (nodeType) {
      case 'start':
      case 'end':
          return (
            <>
                <Form.Item 
                    name="reply_template" 
                    label="回复模板"
                    tooltip="使用 {{variable_name}} 引用输入参数"
                >
                    <Input.TextArea 
                        rows={4} 
                        placeholder="例如: 今天 {{output_location}} 的温度为 {{output_temperature}}" 
                        style={{ backgroundColor: '#fafafa' }}
                    />
                </Form.Item>
            </>
          );
      case 'llm':
        return (
          <>
            <Form.Item name="model" label="模型选择">
              <Select placeholder="选择模型" loading={llmModels.length === 0}>
                  {llmModels.map(model => (
                      <Option key={model.id} value={model.id}>{model.name}</Option>
                  ))}
              </Select>
            </Form.Item>
            <Form.Item name="temperature" label="温度 (Temperature)" initialValue={0.7}>
              <Input type="number" step="0.1" min="0" max="2" />
            </Form.Item>
            <Form.Item name="system_prompt" label="系统提示词 (System Prompt)">
              <Input.TextArea rows={4} placeholder="设定模型的角色和行为..." />
            </Form.Item>
          </>
        );
      case 'knowledge':
        return (
          <Form.Item name="knowledge_base_id" label="关联知识库">
            <Select placeholder="选择知识库" loading={knowledgeBases.length === 0}>
                {knowledgeBases.map(kb => (
                    <Option key={kb.id} value={kb.id}>{kb.name}</Option>
                ))}
            </Select>
          </Form.Item>
        );
      case 'tool':
        return (
          <Form.Item name="tool_name" label="工具选择">
             <Select placeholder="选择工具">
              <Option value="google_search">Google Search</Option>
              <Option value="calculator">Calculator</Option>
              <Option value="weather_api">Weather API</Option>
            </Select>
          </Form.Item>
        );
      case 'mcp':
          return (
             <Form.Item name="mcp_server" label="MCP 服务地址">
                 <Input placeholder="ws://localhost:8080" />
             </Form.Item>
          );
      case 'doc_parser':
          return (
             <Form.Item name="parse_mode" label="解析模型">
                 <Select placeholder="选择解析模型" loading={ocrModels.length === 0}>
                     {ocrModels.map(model => (
                         <Option key={model.id} value={model.id}>
                            {model.name} ({model.type === 'ocr_paddle' ? 'PaddleOCR' : 'DeepSeek-OCR'})
                         </Option>
                     ))}
                 </Select>
             </Form.Item>
          );
      default:
        return (
            <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px', color: '#999' }}>
                该组件暂无系统参数
            </div>
        );
    }
  };

  return (
    <Drawer
      title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>组件配置: {node.data.label}</span>
          </div>
      }
      placement="right"
      onClose={onClose}
      open={isOpen}
      mask={false}
      width={400}
      styles={{
        header: { borderBottom: '1px solid #f0f0f0' },
        body: { padding: '24px' }
      }}
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
      >
        {nodeType !== 'start' && nodeType !== 'end' && (
            <>
                <Form.Item name="label" label="组件名称">
                <Input placeholder="输入组件名称" />
                </Form.Item>
                
                <Form.Item name="description" label="描述">
                    <Input.TextArea rows={2} placeholder="组件功能描述..." />
                </Form.Item>

                <Divider />
            </>
        )}
        
        <Collapse defaultActiveKey={['system', 'input', 'output']} ghost items={[
            {
                key: 'system',
                label: '系统参数 (System Params)',
                children: renderSystemParams(),
            },
            {
                key: 'input',
                label: '输入参数 (Input Params)',
                children: renderInputParams(),
            },
            {
                key: 'output',
                label: '输出参数 (Output Params)',
                children: renderOutputParams(),
            },
        ]} />
      </Form>
    </Drawer>
  );
};
