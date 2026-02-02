import React, { useEffect, useMemo, useState } from 'react';
import { Form, Input, Select, Drawer, Typography, Divider, Collapse, Button, Tag, Checkbox } from 'antd';
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
      // For intent node, automatically sync output_params with intents
      if ((node.data.originalType === 'intent' || node.type === 'intent') && changedValues.intents) {
        const intents = changedValues.intents || [];
        const output_params = intents.map((intent: any) => ({
          name: intent.id || intent.name,
          type: 'string',
          desc: `意图: ${intent.name || intent.id}`
        }));

        // Update with both intents and synced output_params
        onUpdate(node.id, {
          ...allValues,
          output_params
        });
      } else {
        onUpdate(node.id, allValues);
      }
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
            value: `${upNode.id}.${param.name}`,
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

      // For intent node, output params are dynamically generated from intents list
      if (nodeType === 'intent') {
          const intents = form.getFieldValue('intents') || [];

          return (
              <div style={{ fontSize: '12px' }}>
                  <div style={{ marginBottom: '12px', color: '#666' }}>
                      <Text type="secondary">
                          输出参数基于配置的意图自动生成。每个意图对应一个输出连线点。
                      </Text>
                  </div>

                  {intents.length === 0 ? (
                      <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '4px', textAlign: 'center', color: '#999' }}>
                          暂无输出参数，请先在"系统参数"中添加意图
                      </div>
                  ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {intents.map((intent: any, index: number) => (
                              <div
                                  key={intent.id || index}
                                  style={{
                                      display: 'flex',
                                      gap: '8px',
                                      padding: '8px',
                                      background: '#fafafa',
                                      borderRadius: '4px',
                                      border: '1px solid #e8e8e8'
                                  }}
                              >
                                  <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                                          {intent.name || intent.id || `意图${index + 1}`}
                                      </div>
                                      <div style={{ fontSize: '11px', color: '#666' }}>
                                          输出字段: intent_name (string)
                                      </div>
                                  </div>
                                  <Tag color="orange">{intent.is_fallback ? '默认' : '分支'}</Tag>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          );
      }

      // For start node and system nodes (llm, knowledge, tool, doc_parser, excel_parser, output, for_loop, code_block), render read-only output params
      const systemNodes = ['start', 'llm', 'knowledge', 'tool', 'doc_parser', 'excel_parser', 'output', 'for_loop', 'code_block'];
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
          return (
            <>
                <Form.Item
                    label="节点标识名"
                    tooltip="系统内部使用的节点标识，不可修改"
                >
                    <Input value="start_node" disabled style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }} />
                </Form.Item>
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
      case 'excel_parser':
          return (
              <>
                  <Form.Item
                      name="file_url"
                      label="Excel文件路径"
                      tooltip="从上游节点引用文件路径，例如: {{start_node.fileUrls.0}}"
                      extra={
                          upstreamVariables.length > 0 && (
                              <div style={{ marginTop: 4 }}>
                                  <Text type="secondary" style={{ fontSize: '11px' }}>快速选择: </Text>
                                  {upstreamVariables
                                      .filter(v => v.label.includes('fileUrls') || v.label.includes('file'))
                                      .map(v => (
                                          <Typography.Link
                                              key={v.value}
                                              onClick={() => form.setFieldValue('file_url', v.value)}
                                              style={{ fontSize: '11px', marginLeft: 4 }}
                                          >
                                              {v.label}
                                          </Typography.Link>
                                      ))}
                              </div>
                          )
                      }
                  >
                      <Input placeholder="例如: {{start_node.fileUrls.0}}" />
                  </Form.Item>
                  <Form.Item name="sheet_name" label="工作表名称/索引" initialValue={0} tooltip="默认为0（第一个工作表），可指定工作表名称">
                      <Input placeholder="工作表名称或索引（默认0）" />
                  </Form.Item>
                  <Form.Item name="skip_empty_rows" label="跳过空行" valuePropName="checked" initialValue={true}>
                      <Select placeholder="是否跳过空行">
                          <Option value={true}>是</Option>
                          <Option value={false}>否</Option>
                      </Select>
                  </Form.Item>
              </>
          );
      case 'output':
          return (
              <>
                  <Divider orientation="left">意图识别配置</Divider>
                  <div style={{
                      background: '#e6f7ff',
                      border: '1px solid #91d5ff',
                      borderRadius: '4px',
                      padding: '12px',
                      marginBottom: '16px'
                  }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                          <strong>为意图识别节点配置此节点的能力描述：</strong><br />
                          • 意图名称：此功能的可读名称<br />
                          • 示例语句：用户可能说的自然语言表达<br />
                          • 期望参数：需要从用户输入中提取的参数
                      </Text>
                  </div>

                  <Form.Item
                      name="intent_name"
                      label="能力/意图名称"
                      tooltip="此功能的可读名称，供意图识别节点使用"
                      rules={[{ required: false, message: '请输入能力名称' }]}
                  >
                      <Input placeholder="例如: 查询订单、申请退款、投诉建议" />
                  </Form.Item>

                  <Form.Item
                      name="intent_examples"
                      label="用户可能怎么说"
                      tooltip="每行一条自然语言示例，帮助LLM理解用户意图"
                  >
                      <Input.TextArea
                          rows={4}
                          placeholder="例如:&#10;查一下我的订单&#10;我的订单在哪&#10;查询订单物流状态&#10;我要查订单ABC123"
                          style={{ fontSize: '12px' }}
                      />
                  </Form.Item>

                  <Form.Item
                      name="intent_slots"
                      label="期望参数（槽位）"
                      tooltip="需要从用户输入中提取的参数，JSON格式"
                  >
                      <Input.TextArea
                          rows={3}
                          placeholder='{"order_id": "string", "product_name": "string"}'
                          style={{ fontFamily: 'monospace', fontSize: '11px' }}
                      />
                  </Form.Item>

                  <Form.Item
                      name="is_fallback"
                      label="设为默认兜底"
                      valuePropName="checked"
                      tooltip="当无法识别用户意图时，默认跳转到此节点（全局唯一）"
                  >
                      <Select placeholder="是否设为默认兜底">
                          <Option value={false}>否</Option>
                          <Option value={true}>是（默认兜底）</Option>
                      </Select>
                  </Form.Item>

                  <Divider orientation="left">输出配置</Divider>

                  <Form.Item
                      name="output_template"
                      label="输出模板"
                      tooltip="使用 &lbrace;&lbrace;变量名&rbrace;&rbrace; 引用上游节点的输出，如 &lbrace;&lbrace;node_name.field_name&rbrace;&rbrace;"
                  >
                      <Input.TextArea
                          rows={6}
                          placeholder="例如: 姓名: &lbrace;&lbrace;start_node.rawQuery&rbrace;&rbrace; 分析结果: &lbrace;&lbrace;llm_node.text&rbrace;&rbrace; 数据行数: &lbrace;&lbrace;excel_parser_node.row_count&rbrace;&rbrace;"
                          style={{ fontFamily: 'monospace' }}
                      />
                  </Form.Item>
                  <div style={{ color: '#999', fontSize: '12px', marginTop: '-8px', marginBottom: '16px' }}>
                      使用 &lbrace;&lbrace;变量名&rbrace;&rbrace; 引用上游变量，多个变量可自由拼接
                  </div>
              </>
          );
      case 'for_loop':
          return (
              <>
                  <Form.Item
                      name="array_input"
                      label="输入数组"
                      tooltip="选择要遍历的数组变量（仅显示数组类型）"
                      extra={
                          upstreamVariables.filter(v => v.type === 'string[]' || v.type === 'object[]').length > 0 && (
                              <div style={{ marginTop: 4 }}>
                                  <Text type="secondary" style={{ fontSize: '11px' }}>快速选择: </Text>
                                  {upstreamVariables
                                      .filter(v => v.type === 'string[]' || v.type === 'object[]')
                                      .map(v => (
                                          <Typography.Link
                                              key={v.value}
                                              onClick={() => form.setFieldValue('array_input', `{{${v.value}}}`)}
                                              style={{ fontSize: '11px', marginLeft: 4 }}
                                          >
                                              {v.label}
                                          </Typography.Link>
                                      ))}
                              </div>
                          )
                      }
                  >
                      <Input placeholder="{{node_id.field_name}}" />
                  </Form.Item>
                  <Form.Item
                      name="item_alias"
                      label="当前项别名"
                      initialValue="item"
                      tooltip="循环体内引用当前项的变量名"
                  >
                      <Input placeholder="默认: item" />
                  </Form.Item>
                  <Form.Item
                      name="max_iterations"
                      label="最大迭代次数"
                      initialValue={50}
                      tooltip="防止无限循环，最多执行多少次迭代"
                  >
                      <Input type="number" min={1} placeholder="默认: 50" />
                  </Form.Item>
                  <Form.Item
                      name="on_error"
                      label="错误处理"
                      initialValue="skip"
                      tooltip="当某次迭代失败时如何处理"
                  >
                      <Select placeholder="选择错误处理方式">
                          <Option value="skip">跳过（继续下一次迭代）</Option>
                          <Option value="stop">终止（停止整个循环）</Option>
                      </Select>
                  </Form.Item>
              </>
          );
      case 'code_block':
          return (
              <>
                  <div style={{
                      background: '#fff7e6',
                      border: '1px solid #ffd8bf',
                      borderRadius: '4px',
                      padding: '12px',
                      marginBottom: '16px'
                  }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                          <strong>使用说明：</strong><br />
                          • 所有输入变量自动注入到 <code>params</code> 字典中<br />
                          • 处理结果必须写入 <code>output</code> 字典<br />
                          • 示例: <code>output = {"{result: params['value'] * 2}"}</code>
                      </Text>
                  </div>

                  <Form.Item
                      name="code"
                      label="Python 代码"
                      rules={[{ required: true, message: '请输入Python代码' }]}
                      tooltip="编写Python代码处理数据，结果存入output字典"
                  >
                      <Input.TextArea
                          rows={15}
                          placeholder={`# 示例代码\n# 输入变量通过 params 字典访问\n# 处理结果必须存入 output 字典\n\nresult = sum(params.get("numbers", []))\navg = result / len(params.get("numbers", [1])) if params.get("numbers") else 0\n\noutput = {\n    "total": result,\n    "average": avg,\n    "message": f"总计: {result}, 平均: {avg:.2f}"\n}`}
                          style={{
                              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                              fontSize: '12px',
                              lineHeight: '1.5'
                          }}
                      />
                  </Form.Item>

                  <div style={{ color: '#999', fontSize: '12px', marginTop: '-8px', marginBottom: '16px' }}>
                      <strong>安全限制：</strong>禁止文件操作、网络请求、import语句（白名单模块除外）
                  </div>

                  <Form.Item
                      name="timeout"
                      label="超时时间（秒）"
                      initialValue={5}
                      tooltip="代码执行超时时间，防止死循环"
                  >
                      <Input type="number" min={1} max={30} placeholder="默认: 5" />
                  </Form.Item>
              </>
          );
      case 'intent':
          return (
              <>
                  <div style={{
                      background: '#fff7e6',
                      border: '1px solid #ffd8bf',
                      borderRadius: '4px',
                      padding: '12px',
                      marginBottom: '16px'
                  }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                          <strong>意图识别配置说明：</strong><br />
                          • 手动添加意图或从已配置的 Output 节点自动聚合<br />
                          • 使用 LLM Zero-Shot 分类识别用户意图<br />
                          • 自动提取参数（槽位）并输出结构化结果
                      </Text>
                  </div>

                  <Form.Item
                      name="user_input_source"
                      label="用户输入来源"
                      tooltip="选择包含用户原始文本的上游变量"
                      extra={
                          upstreamVariables.filter(v => v.type === 'string').length > 0 && (
                              <div style={{ marginTop: 4 }}>
                                  <Text type="secondary" style={{ fontSize: '11px' }}>快速选择: </Text>
                                  {upstreamVariables
                                      .filter(v => v.type === 'string')
                                      .slice(0, 3)
                                      .map(v => (
                                          <Typography.Link
                                              key={v.value}
                                              onClick={() => form.setFieldValue('user_input_source', `{{${v.value}}}`)}
                                              style={{ fontSize: '11px', marginLeft: 4 }}
                                          >
                                              {v.label}
                                          </Typography.Link>
                                      ))}
                              </div>
                          )
                      }
                  >
                      <Input placeholder="{{start_node.rawQuery}}" />
                  </Form.Item>

                  <Form.Item
                      name="model"
                      label="LLM 模型"
                      tooltip="选择用于意图识别的大模型"
                  >
                      <Select placeholder="选择模型" loading={llmModels.length === 0}>
                          {llmModels.map(model => (
                              <Option key={model.id} value={model.id}>{model.name}</Option>
                          ))}
                      </Select>
                  </Form.Item>

                  <Form.Item
                      name="confidence_threshold"
                      label="置信度阈值"
                      initialValue={0.3}
                      tooltip="低于此阈值将视为未知意图 (0.0-1.0)"
                  >
                      <Input type="number" min={0} max={1} step={0.1} placeholder="默认: 0.3" />
                  </Form.Item>

                  <Form.Item
                      name="fallback_node_id"
                      label="兜底节点ID"
                      tooltip="当无法识别意图时，默认跳转到的节点ID"
                  >
                      <Input placeholder="默认输出节点ID" />
                  </Form.Item>

                  <Form.Item
                      name="timeout"
                      label="超时时间（秒）"
                      initialValue={10}
                      tooltip="LLM调用超时时间"
                  >
                      <Input type="number" min={1} max={60} placeholder="默认: 10" />
                  </Form.Item>

                  <Divider orientation="left">意图列表配置</Divider>

                  {/* Intent List Management */}
                  <Form.List name="intents">
                      {(fields, { add, remove }) => (
                          <>
                              {fields.map(({ key, name, ...restField }) => (
                                  <div key={key} style={{
                                      marginBottom: '16px',
                                      padding: '12px',
                                      background: '#fafafa',
                                      borderRadius: '6px',
                                      border: '1px solid #e8e8e8'
                                  }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                          <Text strong>意图 #{name + 1}</Text>
                                          <Button
                                              type="link"
                                              danger
                                              size="small"
                                              onClick={() => remove(name)}
                                              icon={<span>×</span>}
                                          >
                                              删除
                                          </Button>
                                      </div>

                                      <Form.Item
                                          {...restField}
                                          name={[name, 'id']}
                                          label="意图ID"
                                          style={{ marginBottom: '8px' }}
                                          rules={[{ required: true, message: '请输入意图ID' }]}
                                      >
                                          <Input placeholder="例如: query_order" style={{ fontSize: '12px' }} />
                                      </Form.Item>

                                      <Form.Item
                                          {...restField}
                                          name={[name, 'name']}
                                          label="意图名称"
                                          style={{ marginBottom: '8px' }}
                                          rules={[{ required: true, message: '请输入意图名称' }]}
                                      >
                                          <Input placeholder="例如: 查询订单" style={{ fontSize: '12px' }} />
                                      </Form.Item>

                                      <Form.Item
                                          {...restField}
                                          name={[name, 'examples']}
                                          label="示例语句"
                                          style={{ marginBottom: '8px' }}
                                          tooltip="每行一条，用分号或换行分隔"
                                      >
                                          <Input.TextArea
                                              rows={3}
                                              placeholder="查一下我的订单; 我的订单在哪; 查询订单物流状态"
                                              style={{ fontSize: '12px' }}
                                          />
                                      </Form.Item>

                                      <Form.Item
                                          {...restField}
                                          name={[name, 'slots']}
                                          label="期望参数"
                                          style={{ marginBottom: '8px' }}
                                          tooltip='JSON格式，例如: {"order_id": "string"}'
                                      >
                                          <Input.TextArea
                                              rows={2}
                                              placeholder='{"order_id": "string", "product_name": "string"}'
                                              style={{ fontFamily: 'monospace', fontSize: '11px' }}
                                          />
                                      </Form.Item>

                                      <Form.Item
                                          {...restField}
                                          name={[name, 'node_id']}
                                          label="关联节点ID"
                                          style={{ marginBottom: '0' }}
                                          tooltip="匹配此意图后跳转到的节点ID"
                                      >
                                          <Select placeholder="选择节点" allowClear showSearch>
                                              {nodes && nodes.map(n => (
                                                  <Option key={n.id} value={n.id}>
                                                      {n.data.label || n.id} ({n.type})
                                                  </Option>
                                              ))}
                                          </Select>
                                      </Form.Item>

                                      <Form.Item
                                          {...restField}
                                          name={[name, 'is_fallback']}
                                          valuePropName="checked"
                                          style={{ marginBottom: 0, marginTop: '8px' }}
                                      >
                                          <Checkbox>设为默认兜底</Checkbox>
                                      </Form.Item>
                                  </div>
                              ))}

                              <Form.Item>
                                  <Button
                                      type="dashed"
                                      onClick={() => add()}
                                      block
                                      icon={<span>+</span>}
                                  >
                                      添加意图
                                  </Button>
                              </Form.Item>

                              {fields.length === 0 && (
                                  <div style={{
                                      textAlign: 'center',
                                      color: '#999',
                                      fontSize: '12px',
                                      marginTop: '8px'
                                  }}>
                                      暂无配置的意图，点击上方按钮添加
                                  </div>
                              )}
                          </>
                      )}
                  </Form.List>

                  {/* Auto-import from Output nodes */}
                  <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      background: '#f0f5ff',
                      borderRadius: '4px',
                      border: '1px dashed #adc6ff'
                  }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text strong style={{ fontSize: '12px' }}>从 Output 节点自动导入：</Text>
                          <Button
                              size="small"
                              type="primary"
                              ghost
                              onClick={() => {
                                  // Auto-import from output nodes
                                  const outputNodes = nodes?.filter(n => n.data.originalType === 'output' || n.type === 'output') || [];
                                  const currentIntents = form.getFieldValue('intents') || [];

                                  const newIntents = outputNodes.map((n: any) => {
                                      // Check if this node is already imported
                                      const existing = currentIntents.find((intent: any) => intent.node_id === n.id);
                                      if (existing) return existing;

                                      return {
                                          id: n.id,
                                          name: n.data.intent_name || n.data.label || n.id,
                                          examples: n.data.intent_examples || '',
                                          slots: n.data.intent_slots || '{}',
                                          node_id: n.id,
                                          is_fallback: n.data.is_fallback || false
                                      };
                                  });

                                  form.setFieldsValue({ intents: [...currentIntents, ...newIntents] });
                              }}
                          >
                              自动导入
                          </Button>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                          {nodes && nodes.filter(n => n.data.originalType === 'output' || n.type === 'output').length > 0 ? (
                              <span>检测到 {nodes.filter(n => n.data.originalType === 'output' || n.type === 'output').length} 个 Output 节点可导入</span>
                          ) : (
                              <span>暂无 Output 节点</span>
                          )}
                      </div>
                  </div>
              </>
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
