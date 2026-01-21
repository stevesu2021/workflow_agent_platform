import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form, Input, Button, Card, Row, Col, Select, InputNumber,
  Tabs, Tag, Space, Typography, Divider, message, Spin, Tooltip, Upload, Alert,
  Checkbox, Modal, Switch, Radio, Collapse, Descriptions, Drawer, Timeline
} from 'antd';
import {
  SaveOutlined, PlayCircleOutlined, ArrowLeftOutlined,
  RobotOutlined, ThunderboltOutlined, BookOutlined, PlusOutlined,
  UploadOutlined, FileOutlined, DeleteOutlined, LoadingOutlined,
  ApiOutlined, FormOutlined, FileTextOutlined,
  CheckSquareOutlined, SelectOutlined, InboxOutlined, ExportOutlined,
  EyeOutlined, DownloadOutlined, CodeOutlined, ApartmentOutlined, ReloadOutlined
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

  // State for generated code
  const [generatedCode, setGeneratedCode] = useState<any>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [graphModalVisible, setGraphModalVisible] = useState(false);

  // State for running agent
  const [runModalVisible, setRunModalVisible] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const [runInputs, setRunInputs] = useState<Record<string, any>>({});
  const [runOutputs, setRunOutputs] = useState<Record<string, any>>({});

  // State for loop count
  const [loopCount, setLoopCount] = useState(0);
  const [maxLoops] = useState(10);

  // State for default input configuration
  const [defaultInputModalVisible, setDefaultInputModalVisible] = useState(false);
  const [currentInputField, setCurrentInputField] = useState<IOField | null>(null);
  const [defaultInputForm] = Form.useForm();

  // State for process log drawer
  const [logDrawerVisible, setLogDrawerVisible] = useState(false);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

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

      // Generate requirements document (basic info only)
      const reqDoc = generateRequirementsDoc(agentData, agentConfig);
      setRequirementsDoc(reqDoc);

      // Update config with generated requirements doc
      agentConfig.requirements_doc = reqDoc;

      if (id) {
        await agentsApi.update(id, agentData);
        message.success('智能体保存成功！点击"生成代码"开始生成实现代码。');
      } else {
        const newAgent = await agentsApi.create(agentData);
        message.success('智能体创建成功！点击"生成代码"开始生成实现代码。');
        navigate(`/agentic/${newAgent.id}`);
      }

      // Note: Decomposition is now done as part of "Generate Code" flow
    } catch (error) {
      message.error('Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  // Generate decomposition document using AI
  const generateDecomposition = async (agentData: any, config: AgenticConfig, saveToDb: boolean = false, agentId: string = null) => {
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
      const decompDoc = data.decomposition;
      setDecompositionDoc(decompDoc);

      // Save to database if requested
      if (saveToDb && agentId) {
        config.decomposition_doc = decompDoc;
        agentData.config.decomposition_doc = decompDoc;
        await agentsApi.update(agentId, agentData);
      }

      message.destroy();
      message.success(saveToDb ? '需求拆解文档生成成功并已保存！' : '需求拆解文档生成成功！点击"查看需求拆解"查看详情。');
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
      await generateDecomposition(agentData, agentConfig, true, id);
    } catch (error: any) {
      message.error(`重新拆解失败: ${error.message || '表单验证失败'}`);
    }
  };

  // Handle generate OpenManus + LangGraph code
  const handleGenerateCode = async () => {
    if (!id) {
      message.error('请先保存智能体后再生成代码');
      return;
    }

    try {
      setGeneratingCode(true);
      setLoopCount(0); // Reset loop count

      // Reset decomposition if needed
      if (!decompositionDoc) {
        message.loading('正在生成需求拆解文档...', 0);

        // Get current form values for decomposition
        const values = await form.validateFields();
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
          memory_config: { variables: {}, tables: [], snippets: [] },
          prologue: values.prologue,
          resource_files: resourceFiles.map(f => ({ name: f.name, status: f.status })),
          io_config: ioConfig,
          resource_knowledge_base_id: resourceKnowledgeBaseId,
          requirements_doc: requirementsDoc || undefined,
          decomposition_doc: undefined
        };

        const agentData: AgentCreate = {
          name: values.name,
          description: values.description,
          type: 'agentic',
          flow_json: {},
          config: agentConfig as any
        };

        const response = await fetch('http://localhost:8001/agents/analyze-requirements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_data: agentData, config: agentConfig })
        });

        if (!response.ok) {
          throw new Error('Failed to generate decomposition document');
        }

        const data = await response.json();
        const decompDoc = data.decomposition;
        setDecompositionDoc(decompDoc);

        // Save decomposition document to database
        agentConfig.decomposition_doc = decompDoc;
        agentData.config.decomposition_doc = decompDoc;
        await agentsApi.update(id, agentData);

        message.destroy();
      }

      // Open log drawer to show progress
      setLogDrawerVisible(true);
      handleFetchLogs();

      message.loading('正在生成代码并运行智能体（自动修复模式）...', 0);

      // Call generate-and-run API
      const response = await fetch('http://localhost:8001/agents/generate-and-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: id,
          max_loops: maxLoops
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Generate and run failed');
      }

      // Update loop count
      setLoopCount(result.loop_count || 0);

      message.destroy();

      if (result.success) {
        message.success(`智能体运行成功！完成于第 ${result.loop_count} 次循环`);
      } else {
        message.warning(`智能体运行结束: ${result.message || '达到最大循环次数'}`);
      }

      // Refresh logs
      handleFetchLogs();

    } catch (error: any) {
      message.destroy();
      message.error(`操作失败: ${error.message || '未知错误'}`);
      console.error('Generate and run error:', error);
    } finally {
      setGeneratingCode(false);
    }
  };

  // Handle run agent
  const handleRunAgent = async () => {
    if (!id) {
      message.error('请先保存智能体后再运行');
      return;
    }

    if (!generatedCode) {
      message.error('请先生成代码后再运行');
      return;
    }

    setRunModalVisible(true);
  };

  // Execute agent run
  const executeAgentRun = async () => {
    try {
      setRunningAgent(true);
      message.loading('正在运行智能体...', 0);

      // Prepare uploaded files
      const formData = new FormData();
      formData.append('agent_id', id);

      // Add input values
      formData.append('inputs', JSON.stringify(runInputs));

      // Add uploaded files
      const fileInputs = ioConfig.inputs.filter(f => f.type === 'file');
      for (const field of fileInputs) {
        const file = runInputs[field.name];
        if (file && file instanceof File) {
          formData.append(`file_${field.name}`, file);
        }
      }

      const response = await fetch('http://localhost:8001/agents/run-agent', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to run agent');
      }

      const data = await response.json();
      setRunOutputs(data.outputs || {});
      message.destroy();
      message.success('智能体运行成功！');
    } catch (error: any) {
      message.destroy();
      message.error(`运行失败: ${error.message || '未知错误'}`);
      console.error('Run agent error:', error);
    } finally {
      setRunningAgent(false);
    }
  };

  // Render input field based on type
  const renderInputField = (field: IOField) => {
    const value = runInputs[field.name] || field.default_value || '';

    switch (field.type) {
      case 'text':
        return (
          <Input
            placeholder={field.placeholder || `请输入${field.label}`}
            value={value}
            onChange={(e) => setRunInputs({ ...runInputs, [field.name]: e.target.value })}
          />
        );
      case 'textarea':
        return (
          <TextArea
            placeholder={field.placeholder || `请输入${field.label}`}
            value={value}
            onChange={(e) => setRunInputs({ ...runInputs, [field.name]: e.target.value })}
            rows={4}
          />
        );
      case 'number':
        return (
          <InputNumber
            placeholder={field.placeholder || `请输入${field.label}`}
            value={value}
            onChange={(val) => setRunInputs({ ...runInputs, [field.name]: val })}
            style={{ width: '100%' }}
          />
        );
      case 'file':
        return (
          <Upload
            beforeUpload={(file) => {
              setRunInputs({ ...runInputs, [field.name]: file });
              return false;
            }}
            onRemove={() => {
              setRunInputs({ ...runInputs, [field.name]: null });
            }}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>
              {value ? '重新上传' : '上传文件'}
            </Button>
          </Upload>
        );
      case 'select':
        return (
          <Select
            placeholder={field.placeholder || `请选择${field.label}`}
            value={value}
            onChange={(val) => setRunInputs({ ...runInputs, [field.name]: val })}
            style={{ width: '100%' }}
          >
            {field.options?.map(opt => (
              <Option key={opt} value={opt}>{opt}</Option>
            ))}
          </Select>
        );
      case 'checkbox':
        return (
          <Checkbox
            checked={value}
            onChange={(e) => setRunInputs({ ...runInputs, [field.name]: e.target.checked })}
          >
            {field.label}
          </Checkbox>
        );
      default:
        return null;
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

    // Resource List (新增)
    doc += `## 10. 资源清单\n\n`;
    doc += `本文智能体使用以下资源：\n\n`;

    // LLM Models
    doc += `### 大模型配置\n\n`;
    doc += `**思考模型 (Thinking Model)**:\n`;
    doc += `- 名称: ${config.model_thinking}\n`;
    doc += `- 用途: 复杂推理、任务规划、决策分析\n\n`;

    doc += `**总结模型 (Summary Model)**:\n`;
    doc += `- 名称: ${config.model_summary}\n`;
    doc += `- 用途: 信息提取、结果汇总、格式化输出\n\n`;

    // Knowledge Bases
    if (config.knowledge_bases && config.knowledge_bases.length > 0) {
      doc += `### 知识库配置\n\n`;
      for (const kbId of config.knowledge_bases) {
        const kb = availableKnowledgeBases.find(k => k.id === kbId);
        if (kb) {
          doc += `- **${kb.name}**\n`;
          doc += `  - ID: \`${kb.id}\`\n`;
          doc += `  - 类型: ${kb.type}\n`;
          if (kb.description) doc += `  - 描述: ${kb.description}\n`;
          doc += `\n`;
        }
      }
    }

    // Tools
    if (config.tools && config.tools.length > 0) {
      doc += `### 工具列表\n\n`;
      for (const toolName of config.tools) {
        const tool = availableTools.find(t => t.name === toolName);
        if (tool) {
          doc += `- **${tool.name}**\n`;
          if (tool.description) doc += `  - 描述: ${tool.description}\n`;
          doc += `  - 类型: ${tool.type}\n`;
        } else {
          doc += `- **${toolName}**\n`;
        }
        doc += `\n`;
      }
    }

    // Resource Files
    if (config.resource_files && config.resource_files.length > 0) {
      doc += `### 资源附件\n\n`;
      doc += `以下文件已上传并整合到知识库中：\n\n`;
      for (const file of config.resource_files) {
        doc += `- **${file.name}**\n`;
        doc += `  - 状态: ${file.status}\n`;
      }
      doc += `\n`;
    }

    // API Endpoints (for reference)
    doc += `### 服务端点\n\n`;
    doc += `- **API 基础地址**: \`${window.location.origin}/api\`\n`;
    doc += `- **知识库 API**: \`/api/knowledge/\`\n`;
    doc += `- **工具 API**: \`/api/tools/\`\n`;
    doc += `- **AI 资源 API**: \`/api/ai-resources/\`\n`;
    doc += `\n`;

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

  // Handle default input configuration
  const handleConfigureDefaultInput = (field: IOField) => {
    setCurrentInputField(field);
    defaultInputForm.setFieldsValue({
      default_value: field.default_value || ''
    });
    setDefaultInputModalVisible(true);
  };

  const handleDefaultInputOk = () => {
    defaultInputForm.validateFields().then(values => {
      if (currentInputField) {
        setIoConfig(prev => ({
          ...prev,
          inputs: prev.inputs.map(f =>
            f.id === currentInputField.id
              ? { ...f, default_value: values.default_value }
              : f
          )
        }));
        message.success(`已配置 ${currentInputField.label} 的默认值`);
      }
      setDefaultInputModalVisible(false);
      defaultInputForm.resetFields();
      setCurrentInputField(null);
    });
  };

  // Handle fetch logs
  const handleFetchLogs = async () => {
    if (!id) return;
    setLoadingLogs(true);
    try {
      const response = await fetch(`http://localhost:8001/agents/${id}/logs`);
      if (response.ok) {
        const data = await response.json();
        setAgentLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Open log drawer and fetch logs
  const handleOpenLogDrawer = () => {
    setLogDrawerVisible(true);
    handleFetchLogs();
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
                            {field.required && (
                              <Button
                                type="link"
                                size="small"
                                onClick={() => handleConfigureDefaultInput(field)}
                              >
                                配置默认值
                              </Button>
                            )}
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
                <>
                  {/* Loop Counter Display */}
                  <Space style={{ marginRight: 16 }}>
                    <Tag color={loopCount > 0 ? "processing" : "default"}>
                      Loop: {loopCount}/{maxLoops}
                    </Tag>
                    {loopCount > 0 && (
                      <Tag color={loopCount <= maxLoops ? "success" : "error"}>
                        {loopCount <= maxLoops ? "进行中" : "已达上限"}
                      </Tag>
                    )}
                  </Space>
                  <Space wrap>
                  <Tooltip title={requirementsDoc ? "查看基础需求文档" : "请先保存智能体"}>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => setReqDocModalVisible(true)}
                      disabled={!requirementsDoc}
                    >
                      查看需求文档
                    </Button>
                  </Tooltip>

                  <Tooltip title={decompositionDoc ? "查看AI拆解后的需求文档" : "请先点击'生成代码'生成需求拆解"}>
                    <Button
                      size="small"
                      icon={<FileTextOutlined />}
                      onClick={() => setDecompDocModalVisible(true)}
                      disabled={!decompositionDoc}
                    >
                      查看拆解文档
                    </Button>
                  </Tooltip>

                  <Tooltip title={requirementsDoc ? "重新生成需求拆解文档" : "请先保存智能体"}>
                    <Button
                      size="small"
                      icon={<ThunderboltOutlined />}
                      onClick={handleRegenerateDecomposition}
                      loading={generatingDecomposition}
                      disabled={!requirementsDoc}
                    >
                      重新拆解
                    </Button>
                  </Tooltip>

                  <Tooltip title={id ? "生成OpenManus + LangGraph实现代码" : "请先保存智能体"}>
                    <Button
                      size="small"
                      icon={<CodeOutlined />}
                      onClick={handleGenerateCode}
                      loading={generatingCode}
                      disabled={!id}
                      style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: !id ? '#d9d9d9' : 'white' }}
                    >
                      生成代码
                    </Button>
                  </Tooltip>

                  <Tooltip title={generatedCode ? "查看LangGraph流程图" : "请先生成代码"}>
                    <Button
                      size="small"
                      icon={<ApartmentOutlined />}
                      onClick={() => setGraphModalVisible(true)}
                      disabled={!generatedCode}
                    >
                      查看流程图
                    </Button>
                  </Tooltip>

                  <Tooltip title={generatedCode ? "运行智能体代码" : "请先生成代码"}>
                    <Button
                      size="small"
                      icon={<PlayCircleOutlined />}
                      onClick={handleRunAgent}
                      disabled={!generatedCode}
                      style={{ backgroundColor: '#1890ff', borderColor: '#1890ff', color: !generatedCode ? '#d9d9d9' : 'white' }}
                    >
                      运行代码
                    </Button>
                  </Tooltip>

                  <Tooltip title={requirementsDoc || decompositionDoc ? "下载文档" : "请先保存或生成文档"}>
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
                      disabled={!requirementsDoc && !decompositionDoc}
                    >
                      下载文档
                    </Button>
                  </Tooltip>

                  <Tooltip title={id ? "查看运行日志" : "请先保存智能体"}>
                    <Button
                      size="small"
                      icon={<FileTextOutlined />}
                      onClick={handleOpenLogDrawer}
                      disabled={!id}
                    >
                      查看日志
                    </Button>
                  </Tooltip>
                </Space>
                </>
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

      {/* LangGraph Visualization Modal */}
      <Modal
        title="LangGraph 流程图"
        open={graphModalVisible}
        onCancel={() => setGraphModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setGraphModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {generatedCode?.graph ? (
          <div style={{ padding: '20px' }}>
            {/* Graph visualization using SVG */}
            <svg
              width="100%"
              height="400"
              style={{ border: '1px solid #d9d9d9', borderRadius: '8px', backgroundColor: '#fafafa' }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#1890ff" />
                </marker>
              </defs>
              {/* Render edges */}
              {generatedCode.graph.edges?.map((edge: any, index: number) => {
                const fromNode = generatedCode.graph.nodes.find((n: any) => n.id === edge.from);
                const toNode = generatedCode.graph.nodes.find((n: any) => n.id === edge.to);
                if (!fromNode || !toNode) return null;

                // Simple layout calculation
                const nodeCount = generatedCode.graph.nodes.length;
                const fromIndex = generatedCode.graph.nodes.indexOf(fromNode);
                const toIndex = generatedCode.graph.nodes.indexOf(toNode);

                const x1 = 80 + (fromIndex * 150) % 700;
                const y1 = 80 + Math.floor((fromIndex * 150) / 700) * 120;
                const x2 = 80 + (toIndex * 150) % 700;
                const y2 = 80 + Math.floor((toIndex * 150) / 700) * 120;

                return (
                  <g key={`edge-${index}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#1890ff"
                      strokeWidth="2"
                      markerEnd="url(#arrowhead)"
                    />
                  </g>
                );
              })}

              {/* Render nodes */}
              {generatedCode.graph.nodes?.map((node: any, index: number) => {
                const x = 80 + (index * 150) % 700;
                const y = 80 + Math.floor((index * 150) / 700) * 120;

                return (
                  <g key={`node-${index}`}>
                    <rect
                      x={x - 50}
                      y={y - 20}
                      width="100"
                      height="40"
                      rx="6"
                      fill="#722ed1"
                      stroke="#531dab"
                      strokeWidth="2"
                    />
                    <text
                      x={x}
                      y={y + 5}
                      textAnchor="middle"
                      fill="white"
                      fontSize="12"
                      fontWeight="bold"
                    >
                      {node.label || node.id}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Node descriptions */}
            <div style={{ marginTop: '20px' }}>
              <Title level={5}>节点说明</Title>
              {generatedCode.graph.nodes?.map((node: any, index: number) => (
                <Card key={index} size="small" style={{ marginBottom: '8px' }}>
                  <Space direction="vertical" size={0}>
                    <Text strong>{node.label || node.id}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {node.description || '暂无描述'}
                    </Text>
                  </Space>
                </Card>
              ))}
            </div>

            {/* Workspace info */}
            {generatedCode.workspace_dir && (
              <Alert
                message={`代码已生成到: ${generatedCode.workspace_dir}`}
                description="包含 agent.py, config.py, nodes.py, tools.py, requirements.txt, README.md 等文件"
                type="success"
                showIcon
                style={{ marginTop: '16px' }}
              />
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <ApartmentOutlined style={{ fontSize: 48, color: '#ccc' }} />
            <p style={{ color: '#999' }}>暂无流程图数据</p>
          </div>
        )}
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

      {/* Default Input Configuration Modal */}
      <Modal
        title={`配置默认值 - ${currentInputField?.label || ''}`}
        open={defaultInputModalVisible}
        onOk={handleDefaultInputOk}
        onCancel={() => {
          setDefaultInputModalVisible(false);
          defaultInputForm.resetFields();
          setCurrentInputField(null);
        }}
        width={600}
      >
        <Form form={defaultInputForm} layout="vertical">
          <Alert
            message="配置此输入字段的默认值"
            description="在自动运行智能体时，将使用此默认值作为输入参数。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item label="字段名称">
            <Input value={currentInputField?.name} disabled />
          </Form.Item>

          <Form.Item label="字段类型">
            <Input value={currentInputField?.type} disabled />
          </Form.Item>

          <Form.Item
            name="default_value"
            label="默认值"
            rules={[{ required: true, message: '请输入默认值' }]}
            extra="此值将在自动运行智能体时作为输入参数"
          >
            {currentInputField?.type === 'textarea' ? (
              <TextArea
                rows={4}
                placeholder="请输入默认值..."
              />
            ) : currentInputField?.type === 'number' ? (
              <InputNumber
                style={{ width: '100%' }}
                placeholder="请输入默认值..."
              />
            ) : (
              <Input placeholder="请输入默认值..." />
            )}
          </Form.Item>
        </Form>
      </Modal>

      {/* Agent Run Modal */}
      <Modal
        title="运行智能体"
        open={runModalVisible}
        onCancel={() => setRunModalVisible(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setRunModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="run"
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={executeAgentRun}
            loading={runningAgent}
          >
            运行
          </Button>
        ]}
      >
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
          {/* Inputs Section */}
          {ioConfig.inputs.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Title level={5}>输入参数</Title>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                {ioConfig.inputs.map(field => (
                  <div key={field.id}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>
                        {field.label}
                        {field.required && <Tag color="red" size="small" style={{ marginLeft: 4 }}>必填</Tag>}
                      </Text>
                      {field.description && (
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                          {field.description}
                        </div>
                      )}
                    </div>
                    {renderInputField(field)}
                  </div>
                ))}
              </Space>
            </div>
          )}

          {/* Outputs Section - show after run */}
          {Object.keys(runOutputs).length > 0 && (
            <div>
              <Title level={5}>输出结果</Title>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                {ioConfig.outputs.map(field => {
                  const value = runOutputs[field.name];
                  return (
                    <div key={field.id}>
                      <Text strong>{field.label}</Text>
                      <div
                        style={{
                          marginTop: 8,
                          padding: 12,
                          backgroundColor: '#f5f5f5',
                          borderRadius: 4,
                          minHeight: 60,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {value || '(等待运行...)'}
                      </div>
                    </div>
                  );
                })}
              </Space>
            </div>
          )}

          {/* Instructions */}
          {Object.keys(runOutputs).length === 0 && (
            <Alert
              message="填写输入参数后点击运行"
              description="智能体将根据您的输入执行相应的任务并返回结果"
              type="info"
              showIcon
            />
          )}
        </div>
      </Modal>

      {/* Process Log Drawer */}
      <Drawer
        title="运行日志"
        placement="right"
        size="large"
        open={logDrawerVisible}
        onClose={() => setLogDrawerVisible(false)}
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={handleFetchLogs}
            loading={loadingLogs}
          >
            刷新
          </Button>
        }
      >
        <Spin spinning={loadingLogs}>
          {agentLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              暂无日志记录
            </div>
          ) : (
            <Timeline
              mode="left"
              items={agentLogs.map((log, index) => ({
                label: new Date(log.created_at).toLocaleTimeString('zh-CN'),
                color: log.status === 'success' ? 'green' : log.status === 'error' ? 'red' : 'blue',
                dot: log.status === 'running' ? <LoadingOutlined /> : undefined,
                children: (
                  <div key={log.id}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      <Tag color={
                        log.stage === 'code_generation' ? 'purple' :
                        log.stage === 'venv_setup' ? 'cyan' :
                        log.stage === 'running' ? 'blue' :
                        log.stage === 'fixing' ? 'orange' : 'default'
                      }>
                        {log.stage}
                      </Tag>
                      <Tag color={log.status === 'success' ? 'success' : log.status === 'error' ? 'error' : 'processing'}>
                        {log.status}
                      </Tag>
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>
                        Loop {log.loop_count + 1}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {log.message}
                    </div>
                  </div>
                )
              }))}
            />
          )}
        </Spin>
      </Drawer>
    </div>
  );
};

export default AgenticStudio;
