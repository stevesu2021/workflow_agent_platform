import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form, Input, Button, Card, Row, Col, Select, InputNumber,
  Tabs, Tag, Space, Typography, Divider, message, Spin, Tooltip, Upload, Alert,
  Checkbox, Modal, Switch, Radio, Collapse, Descriptions
} from 'antd';
import {
  SaveOutlined, PlayCircleOutlined, ArrowLeftOutlined,
  RobotOutlined, ThunderboltOutlined, BookOutlined, PlusOutlined,
  UploadOutlined, FileOutlined, DeleteOutlined, LoadingOutlined,
  ApiOutlined, FormOutlined, FileTextOutlined,
  CheckSquareOutlined, SelectOutlined, InboxOutlined, ExportOutlined,
  EyeOutlined, DownloadOutlined
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { agentsApi } from '../api/agents';
import { getTools } from '../api/tools';
import { aiResourcesApi } from '../api/aiResources';
import { knowledgeApi } from '../api/knowledge';
import type { Agent, AgentCreate, AgenticConfig, IOField, IOConfig } from '../types/agent';
import type { Tool } from '../types/tool';
import type { KnowledgeBase } from '../types/knowledge';
import { IO_FIELD_TYPES, FILE_TYPE_OPTIONS } from '../types/agent';

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

  // State for resource attachments
  const [resourceFiles, setResourceFiles] = useState<UploadFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [resourceKnowledgeBaseId, setResourceKnowledgeBaseId] = useState<string | null>(null);

  // State for IO configuration
  const [ioConfig, setIoConfig] = useState<IOConfig>({ inputs: [], outputs: [] });
  const [ioModalVisible, setIoModalVisible] = useState(false);
  const [ioModalMode, setIoModalMode] = useState<'input' | 'output'>('input');
  const [currentIoField, setCurrentIoField] = useState<Partial<IOField> | null>(null);
  const [ioForm] = Form.useForm();

  // State for requirements document
  const [requirementsDoc, setRequirementsDoc] = useState<string>('');
  const [reqDocModalVisible, setReqDocModalVisible] = useState(false);

  // State for decomposition document
  const [decompositionDoc, setDecompositionDoc] = useState<string>('');
  const [generatingDecomposition, setGeneratingDecomposition] = useState(false);
  const [decompDocModalVisible, setDecompDocModalVisible] = useState(false);

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

      // Load vocabulary
      if (config.vocabulary) {
        setVocabulary(config.vocabulary);
      }

      // Load IO config
      if (config.io_config) {
        setIoConfig(config.io_config);
      }

      // Load resource files
      if (config.resource_files) {
        setResourceFiles(config.resource_files.map((f: any, i: number) => ({
          uid: `${i}`,
          name: f.name,
          status: f.status || 'done'
        })));
      }

      // Load resource knowledge base ID
      if (config.resource_knowledge_base_id) {
        setResourceKnowledgeBaseId(config.resource_knowledge_base_id);
      }

      // Load requirements document
      if (config.requirements_doc) {
        setRequirementsDoc(config.requirements_doc);
      }

      // Load decomposition document
      if (config.decomposition_doc) {
        setDecompositionDoc(config.decomposition_doc);
      }
    } catch (error) {
      message.error('Failed to load agent');
    } finally {
      setLoading(false);
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

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    const validExtensions = ['xlsx', 'xls', 'pdf', 'txt', 'doc', 'docx'];

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(fileExtension || '')) {
      message.error('Unsupported file type. Please upload Excel, PDF, TXT, or Word files.');
      return false;
    }

    // Add file to list with uploading status
    const newFile: UploadFile = {
      uid: Date.now().toString(),
      name: file.name,
      status: 'uploading',
      originFileObj: file,
    };
    setResourceFiles([...resourceFiles, newFile]);

    try {
      // Create or get resource knowledge base
      let kbId = resourceKnowledgeBaseId;
      if (!kbId) {
        const agentName = form.getFieldValue('name') || 'Untitled Agent';
        // Determine KB type based on file extension
        const isExcel = fileExtension === 'xlsx' || fileExtension === 'xls';
        const kbData = await knowledgeApi.create({
          name: `${agentName} - Resources`,
          description: 'Auto-generated knowledge base for agent resource files',
          type: isExcel ? 'excel' : 'text'
        });
        kbId = kbData.id;
        setResourceKnowledgeBaseId(kbId);
      }

      // Upload file to knowledge base using appropriate method
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // For Excel files, we need to select columns - use default empty columns for now
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata_columns', '[]');
        await knowledgeApi.uploadExcelDocument(kbId, formData);
      } else {
        await knowledgeApi.uploadDocument(kbId, file);
      }

      // Update file status to done
      setResourceFiles(prev =>
        prev.map(f =>
          f.uid === newFile.uid ? { ...f, status: 'done' as const } : f
        )
      );

      message.success(`${file.name} uploaded successfully`);
    } catch (error: any) {
      message.error(`Failed to upload ${file.name}: ${error.message || 'Unknown error'}`);
      setResourceFiles(prev => prev.filter(f => f.uid !== newFile.uid));
    }

    return false; // Prevent default upload behavior
  };

  const handleRemoveFile = (fileUid: string) => {
    setResourceFiles(prev => prev.filter(f => f.uid !== fileUid));
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      // Include resource knowledge base in knowledge_bases
      let kbList = values.knowledge_bases || [];
      if (resourceKnowledgeBaseId && !kbList.includes(resourceKnowledgeBaseId)) {
        kbList = [...kbList, resourceKnowledgeBaseId];
      }

      const agentConfig: AgenticConfig = {
        model_thinking: values.model_thinking,
        model_summary: values.model_summary,
        max_thoughts: values.max_thoughts,
        tools: values.tools || [],
        knowledge_bases: kbList,
        task_description: values.task_description || '',
        vocabulary: vocabulary,
        memory_config: {
          variables: {},
          tables: [],
          snippets: []
        },
        prologue: values.prologue,
        resource_files: resourceFiles.map(f => ({
          name: f.name,
          status: f.status
        })),
        io_config: ioConfig,
        // Save resource KB ID for reloading
        resource_knowledge_base_id: resourceKnowledgeBaseId,
        // Save documents if they exist
        requirements_doc: requirementsDoc || undefined,
        decomposition_doc: decompositionDoc || undefined
      };

      const agentData: AgentCreate = {
        name: values.name,
        description: values.description,
        type: 'agentic',
        flow_json: {},
        config: agentConfig as any
      };

      // Generate requirements document
      const reqDoc = generateRequirementsDoc(agentData, agentConfig);
      setRequirementsDoc(reqDoc);

      // Update config with generated requirements doc
      agentConfig.requirements_doc = reqDoc;

      if (id) {
        await agentsApi.update(id, agentData);
        message.success('Agent updated successfully. Requirements document generated.');
      } else {
        const newAgent = await agentsApi.create(agentData);
        message.success('Agent created successfully. Requirements document generated.');
        navigate(`/agentic/${newAgent.id}`);
      }

      // Generate decomposition document using thinking LLM
      await generateDecomposition(agentData, agentConfig);
    } catch (error) {
      message.error('Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  // Generate decomposition document using AI
  const generateDecomposition = async (agentData: any, config: AgenticConfig) => {
    try {
      setGeneratingDecomposition(true);
      message.loading('正在生成需求拆解文档...', 0);

      const response = await fetch('http://localhost:8001/agents/analyze-requirements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_data: agentData,
          config: config
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate decomposition document');
      }

      const data = await response.json();
      setDecompositionDoc(data.decomposition);
      message.destroy();
      message.success('需求拆解文档生成成功！点击"查看需求拆解"查看详情。');
    } catch (error: any) {
      message.destroy();
      message.error(`需求拆解失败: ${error.message || '未知错误'}`);
      console.error('Decomposition error:', error);
    } finally {
      setGeneratingDecomposition(false);
    }
  };

  // Handle regenerate decomposition without saving
  const handleRegenerateDecomposition = async () => {
    try {
      // Get current form values
      const values = await form.validateFields();

      // Include resource knowledge base in knowledge_bases
      let kbList = values.knowledge_bases || [];
      if (resourceKnowledgeBaseId && !kbList.includes(resourceKnowledgeBaseId)) {
        kbList = [...kbList, resourceKnowledgeBaseId];
      }

      // Build agent config from current form values
      const agentConfig: AgenticConfig = {
        model_thinking: values.model_thinking,
        model_summary: values.model_summary,
        max_thoughts: values.max_thoughts,
        tools: values.tools || [],
        knowledge_bases: kbList,
        task_description: values.task_description || '',
        vocabulary: vocabulary,
        memory_config: {
          variables: {},
          tables: [],
          snippets: []
        },
        prologue: values.prologue,
        resource_files: resourceFiles.map(f => ({
          name: f.name,
          status: f.status
        })),
        io_config: ioConfig
      };

      // Build agent data
      const agentData: AgentCreate = {
        name: values.name,
        description: values.description,
        type: 'agentic',
        flow_json: {},
        config: agentConfig as any
      };

      // Update requirements doc as well
      const reqDoc = generateRequirementsDoc(agentData, agentConfig);
      setRequirementsDoc(reqDoc);

      // Generate decomposition
      await generateDecomposition(agentData, agentConfig);
    } catch (error: any) {
      message.error(`重新拆解失败: ${error.message || '表单验证失败'}`);
    }
  };

  // Generate requirements document
  const generateRequirementsDoc = (agentData: any, config: AgenticConfig): string => {
    const agentName = agentData.name || 'Untitled Agent';
    const fileName = `${agentName.replace(/\s+/g, '_')}_需求.md`;

    let doc = `# ${agentName} - 需求文档\n\n`;
    doc += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    doc += `---\n\n`;

    // Basic Information
    doc += `## 1. 基本信息\n\n`;
    doc += `- **名称**: ${agentName}\n`;
    doc += `- **描述**: ${agentData.description || '暂无描述'}\n`;
    doc += `- **类型**: Agentic 智能体\n\n`;

    // Task Description
    if (config.task_description) {
      doc += `## 2. 任务描述\n\n`;
      doc += `${config.task_description}\n\n`;
    }

    // Model Configuration
    doc += `## 3. 模型配置\n\n`;
    doc += `- **思考模型**: ${config.model_thinking}\n`;
    doc += `- **总结模型**: ${config.model_summary}\n`;
    doc += `- **最大思考次数**: ${config.max_thoughts}\n\n`;

    // Tools
    if (config.tools && config.tools.length > 0) {
      doc += `## 4. 工具能力\n\n`;
      config.tools.forEach((tool: string) => {
        doc += `- ${tool}\n`;
      });
      doc += `\n`;
    }

    // Knowledge Bases
    if (config.knowledge_bases && config.knowledge_bases.length > 0) {
      doc += `## 5. 知识库\n\n`;
      config.knowledge_bases.forEach((kbId: string) => {
        const kb = availableKnowledgeBases.find(k => k.id === kbId);
        if (kb) {
          doc += `- **${kb.name}**: ${kb.description || ''}\n`;
        }
      });
      doc += `\n`;
    }

    // Resource Files
    if (config.resource_files && config.resource_files.length > 0) {
      doc += `## 6. 资源附件\n\n`;
      config.resource_files.forEach((file: any) => {
        doc += `- ${file.name} (${file.status})\n`;
      });
      doc += `\n`;
    }

    // Vocabulary
    if (config.vocabulary && config.vocabulary.length > 0) {
      doc += `## 7. 专业词汇\n\n`;
      config.vocabulary.forEach((word: string) => {
        doc += `- ${word}\n`;
      });
      doc += `\n`;
    }

    // IO Configuration
    if (config.io_config) {
      doc += `## 8. 输入输出配置\n\n`;

      // Inputs
      if (config.io_config.inputs && config.io_config.inputs.length > 0) {
        doc += `### 输入参数\n\n`;
        config.io_config.inputs.forEach((field: IOField, index: number) => {
          doc += `${index + 1}. **${field.label}**\n`;
          doc += `   - 字段名: \`${field.name}\`\n`;
          doc += `   - 类型: ${field.type}\n`;
          doc += `   - 必填: ${field.required ? '是' : '否'}\n`;
          if (field.placeholder) doc += `   - 占位符: ${field.placeholder}\n`;
          if (field.options) doc += `   - 选项: ${field.options.join(', ')}\n`;
          if (field.file_types) doc += `   - 文件类型: ${field.file_types.join(', ')}\n`;
          if (field.validation) {
            doc += `   - 验证规则: `;
            const rules = [];
            if (field.validation.min_length) rules.push(`最小长度: ${field.validation.min_length}`);
            if (field.validation.max_length) rules.push(`最大长度: ${field.validation.max_length}`);
            if (field.validation.pattern) rules.push(`正则: ${field.validation.pattern}`);
            doc += rules.join(', ') + '\n';
          }
          doc += `\n`;
        });
      }

      // Outputs
      if (config.io_config.outputs && config.io_config.outputs.length > 0) {
        doc += `### 输出参数\n\n`;
        config.io_config.outputs.forEach((field: IOField, index: number) => {
          doc += `${index + 1}. **${field.label}**\n`;
          doc += `   - 字段名: \`${field.name}\`\n`;
          doc += `   - 类型: ${field.type}\n`;
          if (field.placeholder) doc += `   - 占位符: ${field.placeholder}\n`;
          doc += `\n`;
        });
      }
    }

    // Prologue
    if (config.prologue) {
      doc += `## 9. 系统提示词\n\n`;
      doc += `\`\`\`\n${config.prologue}\n\`\`\`\n\n`;
    }

    doc += `---\n\n`;
    doc += `*本文档由 Workflow Agent Platform 自动生成*\n`;

    return doc;
  };

  // IO Configuration Handlers
  const handleAddIOField = (mode: 'input' | 'output') => {
    setIoModalMode(mode);
    setCurrentIoField(null);
    ioForm.resetFields();
    setIoModalVisible(true);
  };

  const handleEditIOField = (mode: 'input' | 'output', field: IOField) => {
    setIoModalMode(mode);
    setCurrentIoField(field);
    ioForm.setFieldsValue(field);
    setIoModalVisible(true);
  };

  const handleDeleteIOField = (mode: 'input' | 'output', fieldId: string) => {
    if (mode === 'input') {
      setIoConfig(prev => ({
        ...prev,
        inputs: prev.inputs.filter(f => f.id !== fieldId)
      }));
    } else {
      setIoConfig(prev => ({
        ...prev,
        outputs: prev.outputs.filter(f => f.id !== fieldId)
      }));
    }
  };

  const handleIOFormOk = () => {
    ioForm.validateFields().then(values => {
      // Process options from comma-separated string to array
      let options: string[] | undefined;
      if (values.options && typeof values.options === 'string') {
        options = values.options.split(',').map((s: string) => s.trim()).filter((s: string) => s);
      }

      const newField: IOField = {
        id: currentIoField?.id || `field_${Date.now()}`,
        name: values.name,
        type: values.type,
        label: values.label,
        placeholder: values.placeholder,
        required: values.required || false,
        default_value: values.default_value,
        options: options,
        file_types: values.file_types,
        validation: values.min_length || values.max_length || values.pattern ? {
          min_length: values.min_length,
          max_length: values.max_length,
          pattern: values.pattern
        } : undefined
      };

      if (ioModalMode === 'input') {
        if (currentIoField) {
          setIoConfig(prev => ({
            ...prev,
            inputs: prev.inputs.map(f => f.id === currentIoField.id ? newField : f)
          }));
        } else {
          setIoConfig(prev => ({
            ...prev,
            inputs: [...prev.inputs, newField]
          }));
        }
      } else {
        if (currentIoField) {
          setIoConfig(prev => ({
            ...prev,
            outputs: prev.outputs.map(f => f.id === currentIoField.id ? newField : f)
          }));
        } else {
          setIoConfig(prev => ({
            ...prev,
            outputs: [...prev.outputs, newField]
          }));
        }
      }

      setIoModalVisible(false);
      ioForm.resetFields();
    });
  };

  const getIOTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <FormOutlined />;
      case 'textarea': return <FileTextOutlined />;
      case 'number': return <InboxOutlined />;
      case 'file': return <UploadOutlined />;
      case 'select': return <SelectOutlined />;
      case 'checkbox': return <CheckSquareOutlined />;
      default: return <FormOutlined />;
    }
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

                <Divider titlePlacement="left">Resource Attachments</Divider>
                <Alert
                  title="Upload resource files (Excel, PDF, TXT, Word)"
                  description="Upload files to be used as knowledge resources for this agent. A knowledge base will be automatically created."
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Upload
                  beforeUpload={handleFileUpload}
                  showUploadList={false}
                  multiple
                  accept=".xlsx,.xls,.pdf,.txt,.doc,.docx"
                >
                  <Button icon={<UploadOutlined />} loading={uploadingFiles}>
                    Upload Files
                  </Button>
                </Upload>

                {resourceFiles.length > 0 && (
                  <Space orientation="vertical" style={{ marginTop: 16, width: '100%' }}>
                    {resourceFiles.map((file) => (
                      <Card
                        key={file.uid}
                        size="small"
                        style={{ backgroundColor: '#fafafa' }}
                        extra={
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveFile(file.uid)}
                          />
                        }
                      >
                        <Space>
                          {file.status === 'uploading' ? <LoadingOutlined /> : <FileOutlined />}
                          <div>
                            <div style={{ fontWeight: 500 }}>{file.name}</div>
                            <div>
                              {file.status === 'done' ? (
                                <Tag color="success">Uploaded</Tag>
                              ) : (
                                <Tag color="processing">Uploading...</Tag>
                              )}
                            </div>
                          </div>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}

                <Divider />

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

              <Card title="IO Configuration" style={{ marginBottom: 24 }}>
                <Alert
                  title="Define input and output parameters for this agent"
                  description="Configure the input fields users will provide and the output format the agent will generate."
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                {/* Inputs */}
                <Divider titlePlacement="left"><ApiOutlined /> Inputs</Divider>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="dashed"
                    onClick={() => handleAddIOField('input')}
                    icon={<PlusOutlined />}
                    block
                  >
                    Add Input Field
                  </Button>
                </div>

                {ioConfig.inputs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
                    No input fields configured
                  </div>
                ) : (
                  <Space orientation="vertical" style={{ width: '100%', marginBottom: 16 }}>
                    {ioConfig.inputs.map(field => (
                      <Card
                        key={field.id}
                        size="small"
                        style={{ backgroundColor: '#fafafa' }}
                        extra={
                          <Space>
                            <Button
                              type="link"
                              size="small"
                              onClick={() => handleEditIOField('input', field)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="link"
                              danger
                              size="small"
                              onClick={() => handleDeleteIOField('input', field.id)}
                            >
                              Delete
                            </Button>
                          </Space>
                        }
                      >
                        <Space>
                          {getIOTypeIcon(field.type)}
                          <div>
                                <div style={{ fontWeight: 500 }}>{field.label}</div>
                                <div style={{ fontSize: 12, color: '#666' }}>
                                  {field.name} • {field.type}
                                  {field.required && <Tag color="red" size="small" style={{ marginLeft: 4 }}>Required</Tag>}
                                </div>
                          </div>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}

                {/* Outputs */}
                <Divider titlePlacement="left"><ExportOutlined /> Outputs</Divider>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="dashed"
                    onClick={() => handleAddIOField('output')}
                    icon={<PlusOutlined />}
                    block
                  >
                    Add Output Field
                  </Button>
                </div>

                {ioConfig.outputs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
                    No output fields configured
                  </div>
                ) : (
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    {ioConfig.outputs.map(field => (
                      <Card
                        key={field.id}
                        size="small"
                        style={{ backgroundColor: '#fafafa' }}
                        extra={
                          <Space>
                            <Button
                              type="link"
                              size="small"
                              onClick={() => handleEditIOField('output', field)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="link"
                              danger
                              size="small"
                              onClick={() => handleDeleteIOField('output', field.id)}
                            >
                              Delete
                            </Button>
                          </Space>
                        }
                      >
                        <Space>
                          {getIOTypeIcon(field.type)}
                          <div>
                            <div style={{ fontWeight: 500 }}>{field.label}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>
                              {field.name} • {field.type}
                            </div>
                          </div>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}
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
            <Card
              title="Agent Preview"
              style={{ height: '100%' }}
              styles={{ body: { height: 'calc(100% - 58px)', overflow: 'auto' } }}
              extra={
                <Space>
                  {requirementsDoc && (
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => setReqDocModalVisible(true)}
                    >
                      查看需求文档
                    </Button>
                  )}
                  {decompositionDoc && (
                    <Button
                      size="small"
                      icon={<FileTextOutlined />}
                      onClick={() => setDecompDocModalVisible(true)}
                      type="primary"
                    >
                      查看需求拆解
                    </Button>
                  )}
                  {requirementsDoc && (
                    <Button
                      size="small"
                      icon={<ThunderboltOutlined />}
                      onClick={handleRegenerateDecomposition}
                      loading={generatingDecomposition}
                    >
                      重新拆解需求
                    </Button>
                  )}
                  {(requirementsDoc || decompositionDoc) && (
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => {
                        const docToDownload = decompositionDoc || requirementsDoc;
                        const suffix = decompositionDoc ? '需求拆解.md' : '需求.md';
                        const blob = new Blob([docToDownload], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${form.getFieldValue('name') || 'agent'}_${suffix}`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      下载
                    </Button>
                  )}
                </Space>
              }
            >
              {generatingDecomposition ? (
                <div style={{ textAlign: 'center', marginTop: 40, padding: 20 }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 16, color: '#666' }}>
                    AI正在分析需求并生成拆解文档...
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    这可能需要几十秒时间
                  </div>
                </div>
              ) : decompositionDoc ? (
                <div>
                  <Alert
                    title="需求拆解文档已生成"
                    description="AI已基于需求文档生成详细的实现方案"
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <Collapse
                    items={[
                      {
                        key: '1',
                        label: '拆解文档预览',
                        children: (
                          <div style={{
                            backgroundColor: '#f5f5f5',
                            padding: 12,
                            borderRadius: 4,
                            fontSize: 12,
                            maxHeight: 300,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace'
                          }}>
                            {decompositionDoc.substring(0, 2000)}...
                          </div>
                        )
                      }
                    ]}
                  />
                </div>
              ) : requirementsDoc ? (
                <div>
                  <Alert
                    title="需求文档已生成"
                    description="保存后，AI将自动生成详细的需求拆解文档"
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <Collapse
                    items={[
                      {
                        key: '1',
                        label: '文档预览',
                        children: (
                          <div style={{
                            backgroundColor: '#f5f5f5',
                            padding: 12,
                            borderRadius: 4,
                            fontSize: 12,
                            maxHeight: 300,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace'
                          }}>
                            {requirementsDoc}
                          </div>
                        )
                      }
                    ]}
                  />
                </div>
              ) : (
                <div style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>
                  <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <Paragraph>
                    This agent will be automatically constructed using LangGraph based on your configuration.
                  </Paragraph>
                  <Paragraph type="secondary">
                    填写配置后点击 "Save" 按钮生成需求文档和AI拆解文档
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
              )}
            </Card>
          </Col>
        </Row>
      </div>

      {/* Requirements Document Modal */}
      <Modal
        title="需求文档"
        open={reqDocModalVisible}
        onCancel={() => setReqDocModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setReqDocModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              const blob = new Blob([requirementsDoc], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${form.getFieldValue('name') || 'agent'}_需求.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            下载文档
          </Button>
        ]}
      >
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: 16,
          borderRadius: 4,
          maxHeight: '60vh',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: 13
        }}>
          {requirementsDoc}
        </div>
      </Modal>

      {/* Decomposition Document Modal */}
      <Modal
        title="需求拆解文档"
        open={decompDocModalVisible}
        onCancel={() => setDecompDocModalVisible(false)}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setDecompDocModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              const blob = new Blob([decompositionDoc], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${form.getFieldValue('name') || 'agent'}_需求拆解.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            下载文档
          </Button>
        ]}
      >
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: 16,
          borderRadius: 4,
          maxHeight: '60vh',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: 13
        }}>
          {decompositionDoc}
        </div>
      </Modal>

      {/* IO Field Edit Modal */}
      <Modal
        title={`${currentIoField ? 'Edit' : 'Add'} ${ioModalMode === 'input' ? 'Input' : 'Output'} Field`}
        open={ioModalVisible}
        onOk={handleIOFormOk}
        onCancel={() => {
          setIoModalVisible(false);
          ioForm.resetFields();
        }}
        width={600}
      >
        <Form form={ioForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Field Name" rules={[{ required: true }]} extra="Used in code/backend">
                <Input placeholder="e.g., user_query" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="Field Type" rules={[{ required: true }]}>
                <Select placeholder="Select type">
                  {IO_FIELD_TYPES.map(type => (
                    <Option key={type.value} value={type.value}>{type.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="label" label="Display Label" rules={[{ required: true }]} extra="Shown to users">
            <Input placeholder="e.g., User Query" />
          </Form.Item>

          <Form.Item name="placeholder" label="Placeholder">
            <Input placeholder="e.g., Enter your question..." />
          </Form.Item>

          <Form.Item name="required" label="Required" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}>
            {({ getFieldValue }) => {
              const fieldType = getFieldValue('type');

              if (fieldType === 'select') {
                return (
                  <Form.Item name="options" label="Options" extra="Enter options separated by commas">
                    <Input placeholder="Option 1, Option 2, Option 3" />
                  </Form.Item>
                );
              }

              if (fieldType === 'file') {
                return (
                  <Form.Item name="file_types" label="Allowed File Types">
                    <Checkbox.Group style={{ width: '100%' }}>
                      <Row>
                        {FILE_TYPE_OPTIONS.map(ft => (
                          <Col span={8} key={ft.value}>
                            <Checkbox value={ft.value}>{ft.label}</Checkbox>
                          </Col>
                        ))}
                      </Row>
                    </Checkbox.Group>
                  </Form.Item>
                );
              }

              return null;
            }}
          </Form.Item>

          <Divider>Validation (Optional)</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="min_length" label="Min Length">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_length" label="Max Length">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="pattern" label="Pattern (Regex)">
            <Input placeholder="e.g., ^[a-zA-Z]+$" />
          </Form.Item>

          <Form.Item name="default_value" label="Default Value">
            <Input placeholder="Default value for this field" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AgenticStudio;
