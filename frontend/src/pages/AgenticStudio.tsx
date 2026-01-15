import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Form, Input, Button, Card, Row, Col, Select, InputNumber, 
  Tabs, Tag, Space, Typography, Divider, message, Spin, Tooltip
} from 'antd';
import {
  SaveOutlined, PlayCircleOutlined, ArrowLeftOutlined,
  RobotOutlined, ThunderboltOutlined, BookOutlined, PlusOutlined
} from '@ant-design/icons';
import { agentsApi } from '../api/agents';
import { getTools } from '../api/tools';
import { aiResourcesApi } from '../api/aiResources';
import { knowledgeApi } from '../api/knowledge';
import type { Agent, AgentCreate, AgenticConfig } from '../types/agent';
import type { Tool } from '../types/tool';
import type { KnowledgeBase } from '../types/knowledge';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const AgenticStudio: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [aiModels, setAiModels] = useState<any[]>([]);

  // State for tags (Vocabulary)
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    fetchResources();
    if (id) {
      fetchAgent(id);
    }
  }, [id]);

  const fetchResources = async () => {
    try {
      const [toolsData, resourcesData, kbData] = await Promise.all([
        getTools(),
        aiResourcesApi.getAll(),
        knowledgeApi.list()
      ]);
      setAvailableTools(toolsData);
      setAvailableKnowledgeBases(kbData);
      setAiModels(resourcesData.filter((r: any) => r.type === 'text_llm'));
    } catch (error) {
      message.error('Failed to load resources');
    }
  };

  const fetchAgent = async (agentId: string) => {
    setLoading(true);
    try {
      const data = await agentsApi.getById(agentId);
      setAgent(data);
      
      // Parse config
      const version = data.versions?.[0]; // Get latest version
      const config = version?.config || {};
      
      form.setFieldsValue({
        name: data.name,
        description: data.description,
        ...config
      });

      if (config.vocabulary) {
        setVocabulary(config.vocabulary);
      }
    } catch (error) {
      message.error('Failed to load agent');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const agentConfig: AgenticConfig = {
        model_thinking: values.model_thinking,
        model_summary: values.model_summary,
        max_thoughts: values.max_thoughts,
        tools: values.tools || [],
        knowledge_bases: values.knowledge_bases || [],
        task_description: values.task_description || '',
        vocabulary: vocabulary,
        memory_config: {
          variables: {}, // TODO: Add UI for variables
          tables: [],
          snippets: []
        },
        prologue: values.prologue
      };

      const agentData: AgentCreate = {
        name: values.name,
        description: values.description,
        type: 'agentic',
        flow_json: {}, // Agentic agents generate flow automatically
        config: agentConfig as any
      };

      if (id) {
        await agentsApi.update(id, agentData);
        message.success('Agent updated successfully');
      } else {
        const newAgent = await agentsApi.create(agentData);
        message.success('Agent created successfully');
        navigate(`/agentic/${newAgent.id}`);
      }
    } catch (error) {
      message.error('Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  // Tag Input Handlers
  const handleClose = (removedTag: string) => {
    const newTags = vocabulary.filter(tag => tag !== removedTag);
    setVocabulary(newTags);
  };

  const handleInputConfirm = () => {
    if (inputValue && vocabulary.indexOf(inputValue) === -1) {
      setVocabulary([...vocabulary, inputValue]);
    }
    setInputVisible(false);
    setInputValue('');
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 24px', 
        background: '#fff', 
        borderBottom: '1px solid #f0f0f0',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/agents')} />
          <Title level={4} style={{ margin: 0 }}>
            {id ? `Edit Agent: ${agent?.name}` : 'Create Agentic Agent'}
          </Title>
          <Tag color="purple">Agentic</Tag>
        </Space>
        <Space>
          <Button icon={<PlayCircleOutlined />}>Debug</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        </Space>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: '#f5f5f5' }}>
        <Row gutter={24}>
          {/* Left Column: Configuration */}
          <Col span={16}>
            <Form form={form} layout="vertical">
              <Card title="Basic Information" style={{ marginBottom: 24 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                      <Input placeholder="Agent Name" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="description" label="Description">
                      <Input placeholder="What does this agent do?" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Card title="Model Configuration" style={{ marginBottom: 24 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="model_thinking" label="Thinking Model" rules={[{ required: true }]}>
                      <Select placeholder="Select LLM">
                        {aiModels.map(m => <Option key={m.id} value={m.name}>{m.name}</Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="model_summary" label="Summary Model" rules={[{ required: true }]}>
                      <Select placeholder="Select LLM">
                        {aiModels.map(m => <Option key={m.id} value={m.name}>{m.name}</Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="max_thoughts" label="Max Thoughts" initialValue={5}>
                      <InputNumber min={1} max={20} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Card title="Capabilities & Knowledge" style={{ marginBottom: 24 }}>
                <Form.Item name="tools" label="Tools">
                  <Select mode="multiple" placeholder="Select tools" optionFilterProp="children">
                    {availableTools.map(t => <Option key={t.id} value={t.name}>{t.name}</Option>)}
                  </Select>
                </Form.Item>

                <Form.Item name="knowledge_bases" label="Knowledge Bases">
                  <Select mode="multiple" placeholder="Select knowledge bases" optionFilterProp="children">
                    {availableKnowledgeBases.map(kb => (
                      <Option key={kb.id} value={kb.id}>
                        {kb.name} {kb.description && `(${kb.description})`}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item name="task_description" label="Task Description">
                  <TextArea
                    rows={6}
                    placeholder="Describe the agent's task in detail. What should this agent accomplish? What are the specific objectives and constraints?"
                  />
                </Form.Item>

                <Form.Item label="Professional Vocabulary">
                  <div style={{ marginBottom: 8 }}>
                    {vocabulary.map((tag, index) => (
                      <Tag key={tag} closable onClose={() => handleClose(tag)}>
                        {tag}
                      </Tag>
                    ))}
                    {inputVisible && (
                      <Input
                        type="text"
                        size="small"
                        style={{ width: 78 }}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleInputConfirm}
                        onPressEnter={handleInputConfirm}
                        autoFocus
                      />
                    )}
                    {!inputVisible && (
                      <Tag onClick={() => setInputVisible(true)} style={{ borderStyle: 'dashed' }}>
                        <PlusOutlined /> New Tag
                      </Tag>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Add domain-specific terms, synonyms, or colloquialisms to enhance understanding.
                  </Text>
                </Form.Item>

                <Form.Item name="prologue" label="Prologue / System Prompt">
                  <TextArea rows={4} placeholder="Initial instructions or greeting..." />
                </Form.Item>
              </Card>

              <Card title="Memory Configuration">
                <Paragraph type="secondary">
                  Memory variables and tables configuration will be implemented here.
                </Paragraph>
              </Card>
            </Form>
          </Col>

          {/* Right Column: Preview / Debug */}
          <Col span={8}>
            <Card title="Agent Preview" style={{ height: '100%' }} bodyStyle={{ height: 'calc(100% - 58px)', overflow: 'auto' }}>
              <div style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>
                <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <Paragraph>
                  This agent will be automatically constructed using LangGraph based on your configuration.
                </Paragraph>
                <Divider />
                <div style={{ textAlign: 'left' }}>
                  <Text strong>Construction Logic:</Text>
                  <ul>
                    <li>Analyzes description and tools</li>
                    <li>Generates LangGraph code</li>
                    <li>Compiles graph structure</li>
                    <li>Ready for execution</li>
                  </ul>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default AgenticStudio;
