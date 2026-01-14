import React, { useState, useEffect, useMemo } from 'react';
import {
  Layout,
  Tabs,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Card,
  Tooltip,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ApiOutlined,
  SettingOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { AiResourceType, AiResourceTypeLabels } from '../types/aiResource';
import type { AiResource, AiResourceCreate, AiResourceUpdate } from '../types/aiResource';
import { aiResourcesApi } from '../api/aiResources';
import ResourceTestModal from '../components/ResourceTestModal';

const { Content } = Layout;
const { Option } = Select;

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [resources, setResources] = useState<AiResource[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [editingResource, setEditingResource] = useState<AiResource | null>(null);
  const [form] = Form.useForm();
  const [testingId, setTestingId] = useState<string | null>(null);
  
  // Test Case Modal State
  const [testCaseResource, setTestCaseResource] = useState<AiResource | null>(null);
  const [isTestModalVisible, setIsTestModalVisible] = useState<boolean>(false);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const data = await aiResourcesApi.getAll();
      setResources(data);
    } catch (error) {
      message.error('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const handleCreate = () => {
    setEditingResource(null);
    form.resetFields();
    // Set default type based on active tab if not 'all'
    if (activeTab !== 'all') {
      form.setFieldsValue({ type: activeTab, is_enabled: true });
    } else {
      form.setFieldsValue({ type: AiResourceType.TEXT_LLM, is_enabled: true });
    }
    setIsModalVisible(true);
  };

  const handleEdit = (record: AiResource) => {
    setEditingResource(record);
    form.setFieldsValue({
      ...record,
      // API key is masked, so we don't want to fill it in unless user wants to change it
      api_key: undefined 
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await aiResourcesApi.delete(id);
      message.success('Resource deleted successfully');
      fetchResources();
    } catch (error) {
      message.error('Failed to delete resource');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      // Parse config from string if needed, or handle as object
      // For now, let's assume specific config fields might be added later
      // Current form just collects basics. 
      
      if (editingResource) {
        const updateData: AiResourceUpdate = { ...values };
        if (!updateData.api_key) {
           delete updateData.api_key; // Don't send empty string if not changed
        }
        await aiResourcesApi.update(editingResource.id, updateData);
        message.success('Resource updated successfully');
      } else {
        await aiResourcesApi.create(values as AiResourceCreate);
        message.success('Resource created successfully');
      }
      setIsModalVisible(false);
      fetchResources();
    } catch (error) {
      console.error(error);
      message.error('Operation failed');
    }
  };

  const handleTestConnection = async (record: AiResource) => {
    setTestingId(record.id);
    try {
      const result = await aiResourcesApi.testConnection(record.id);
      if (result.success) {
        message.success(`Connection successful (${result.latency_ms}ms)`);
      } else {
        message.error(`Connection failed: ${result.message}`);
      }
      fetchResources(); // Refresh to show new health status
    } catch (error) {
      message.error('Test connection failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDefault = async (record: AiResource) => {
    try {
      await aiResourcesApi.setDefault(record.id);
      message.success('Default resource set');
      fetchResources();
    } catch (error) {
      message.error('Failed to set default');
    }
  };

  const handleTestCase = (record: AiResource) => {
    setTestCaseResource(record);
    setIsTestModalVisible(true);
  };

  const filteredResources = activeTab === 'all' 
    ? resources 
    : resources.filter(r => r.type === activeTab);

  const columns = useMemo(() => [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: AiResource) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{text}</span>
          {record.is_default && <Tag color="blue">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag>{AiResourceTypeLabels[type] || type}</Tag>,
    },
    {
      title: '端点',
      dataIndex: 'endpoint',
      key: 'endpoint',
      ellipsis: true,
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: AiResource) => (
        <Space>
           <Tag color={record.is_enabled ? 'green' : 'default'}>
             {record.is_enabled ? '已启用' : '已禁用'}
           </Tag>
           {record.health_status === 'healthy' && <Tooltip title="健康"><CheckCircleOutlined style={{ color: '#52c41a' }} /></Tooltip>}
           {record.health_status === 'unhealthy' && <Tooltip title="不健康"><CloseCircleOutlined style={{ color: '#ff4d4f' }} /></Tooltip>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AiResource) => (
        <Space size="small">
          <Tooltip title="测试用例">
            <Button 
              icon={<PlayCircleOutlined />} 
              onClick={() => handleTestCase(record)} 
            />
          </Tooltip>
          <Tooltip title="测试连接">
            <Button 
              icon={<ApiOutlined />} 
              onClick={() => handleTestConnection(record)} 
              loading={testingId === record.id}
            />
          </Tooltip>
          <Tooltip title="设为默认">
             <Button 
               icon={<CheckCircleOutlined />} 
               disabled={record.is_default || !record.is_enabled}
               onClick={() => handleSetDefault(record)}
             />
          </Tooltip>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ], [testingId]);

  const tabItems = [
    { key: 'all', label: '所有资源' },
    ...Object.entries(AiResourceTypeLabels).map(([key, label]) => ({
      key,
      label,
    })),
  ];

  return (
    <Layout style={{ padding: '24px', background: '#fff' }}>
      <Content>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}><SettingOutlined /> 系统资源</h2>
            <span style={{ color: '#888' }}>管理您的 AI 模型和系统配置</span>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            添加资源
          </Button>
        </div>

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={tabItems}
        />

        <Table 
          columns={columns} 
          dataSource={filteredResources} 
          rowKey="id" 
          loading={loading}
        />

        <Modal
          title={editingResource ? "编辑资源" : "添加资源"}
          open={isModalVisible}
          onOk={handleModalOk}
          onCancel={() => setIsModalVisible(false)}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{ is_enabled: true, is_default: false }}
          >
            <Form.Item
              name="name"
              label="名称"
              rules={[{ required: true, message: '请输入名称' }]}
            >
              <Input placeholder="例如：Qwen-Max" />
            </Form.Item>

            <Form.Item
              name="type"
              label="类型"
              rules={[{ required: true, message: '请选择类型' }]}
            >
              <Select disabled={!!editingResource}>
                {Object.entries(AiResourceTypeLabels).map(([key, label]) => (
                  <Option key={key} value={key}>{label}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="endpoint"
              label="端点 URL"
              rules={[{ required: true, message: '请输入端点 URL' }]}
            >
              <Input placeholder="https://api.example.com/v1" />
            </Form.Item>

            <Form.Item
              name="api_key"
              label="API Key"
              extra="留空以保持不变（编辑时）"
            >
              <Input.Password placeholder="sk-..." />
            </Form.Item>

            <Form.Item
              name="description"
              label="描述"
            >
              <Input.TextArea rows={2} />
            </Form.Item>

            <Space>
              <Form.Item name="is_enabled" valuePropName="checked" label="启用">
                <Switch />
              </Form.Item>
              <Form.Item name="is_default" valuePropName="checked" label="设为该类型默认">
                <Switch />
              </Form.Item>
            </Space>
          </Form>
        </Modal>

        <ResourceTestModal 
          resource={testCaseResource}
          visible={isTestModalVisible}
          onCancel={() => setIsTestModalVisible(false)}
        />
      </Content>
    </Layout>
  );
};

export default Settings;
