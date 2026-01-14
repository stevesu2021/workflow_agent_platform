import React, { useEffect, useState, useMemo } from 'react';
import { Button, Modal, Form, Input, Select, message, Tabs, Card, Row, Col, Typography, Empty, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined, SearchOutlined } from '@ant-design/icons';
import * as AntIcons from '@ant-design/icons';
import { getTools, createTool, updateTool, deleteTool } from '../api/tools';
import type { Tool, ToolCreate } from '../types/tool';
import { itTools, categories } from '../data/itTools';

const { Meta } = Card;
const { Title, Paragraph, Text } = Typography;
const { Search } = Input;

const ToolManager: React.FC = () => {
  // Custom Tools State
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [form] = Form.useForm();

  // IT-Tools State
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  // Fetch Custom Tools
  const fetchTools = async () => {
    setLoading(true);
    try {
      const data = await getTools();
      setTools(data);
    } catch (error) {
      message.error('Failed to fetch tools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  // Handlers for Custom Tools
  const handleAdd = () => {
    setEditingTool(null);
    form.resetFields();
    form.setFieldsValue({ config: '{}', type: 'api' });
    setModalVisible(true);
  };

  const handleEdit = (tool: Tool, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTool(tool);
    form.setFieldsValue({
      ...tool,
      config: JSON.stringify(tool.config, null, 2),
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: '确定要删除此工具吗？',
      content: '此操作无法撤销。',
      okText: '是',
      cancelText: '否',
      onOk: async () => {
        try {
          await deleteTool(id);
          message.success('工具删除成功');
          fetchTools();
        } catch (error) {
          message.error('删除工具失败');
        }
      }
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let config = {};
      try {
        config = JSON.parse(values.config);
      } catch (e) {
        message.error('配置 JSON 格式无效');
        return;
      }

      const toolData: ToolCreate = {
        name: values.name,
        description: values.description,
        type: values.type,
        config: config,
      };

      if (editingTool) {
        await updateTool(editingTool.id, toolData);
        message.success('工具更新成功');
      } else {
        await createTool(toolData);
        message.success('工具创建成功');
      }

      setModalVisible(false);
      fetchTools();
    } catch (error) {
      console.error(error);
    }
  };

  // Filtering IT-Tools
  const filteredITTools = useMemo(() => {
    return itTools.filter(tool => {
      const matchesCategory = activeCategory === 'All' || tool.category === activeCategory;
      const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            tool.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm]);

  // Render Icon Dynamically
  const renderIcon = (iconName?: string) => {
    if (!iconName) return <AppstoreOutlined />;
    const IconComponent = (AntIcons as any)[iconName];
    return IconComponent ? <IconComponent /> : <AppstoreOutlined />;
  };

  const openITTool = (path: string) => {
    setIframeUrl(`http://localhost:8080${path}`);
  };

  const items = [
    {
      key: 'it-tools',
      label: '内置工具箱 (IT-Tools)',
      children: (
        <div>
          <div style={{ marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Select 
              defaultValue="All" 
              style={{ width: 200 }} 
              onChange={setActiveCategory}
              options={[{ value: 'All', label: '所有分类' }, ...categories.map(c => ({ value: c, label: c }))]}
            />
            <Search 
              placeholder="搜索工具..." 
              allowClear 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ width: 300 }} 
            />
          </div>
          
          {filteredITTools.length > 0 ? (
            <Row gutter={[16, 16]}>
              {filteredITTools.map((tool) => (
                <Col xs={24} sm={12} md={8} lg={6} xl={4} key={tool.path}>
                  <Card 
                    hoverable 
                    onClick={() => openITTool(tool.path)}
                    style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                    bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 24, color: '#1890ff', marginRight: 12 }}>
                        {renderIcon(tool.icon)}
                      </div>
                      <Tooltip title={`http://localhost:8080${tool.path}`} placement="top">
                        <Text strong style={{ fontSize: 16 }}>{tool.name}</Text>
                      </Tooltip>
                    </div>
                    <Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ flex: 1, marginBottom: 0 }}>
                      {tool.description}
                    </Paragraph>
                    <div style={{ marginTop: 12 }}>
                      <Tag color="blue">{tool.category}</Tag>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description="未找到匹配的工具" />
          )}
        </div>
      ),
    },
    {
      key: 'custom-tools',
      label: '自定义工具 (API/Function)',
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加工具
            </Button>
          </div>
          
          {tools.length > 0 ? (
            <Row gutter={[16, 16]}>
              {tools.map(tool => (
                <Col xs={24} sm={12} md={8} lg={6} key={tool.id}>
                  <Card 
                    title={tool.name} 
                    extra={
                      <Space>
                        <Button type="text" icon={<EditOutlined />} onClick={(e) => handleEdit(tool, e)} />
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={(e) => handleDelete(tool.id, e)} />
                      </Space>
                    }
                    actions={[
                      <span key="type">类型: {tool.type.toUpperCase()}</span>
                    ]}
                  >
                    <Paragraph ellipsis={{ rows: 2 }}>{tool.description || '暂无描述'}</Paragraph>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      创建于: {new Date(tool.created_at).toLocaleDateString()}
                    </Text>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description="暂无自定义工具" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>工具管理</Title>
        <Paragraph type="secondary">
          集成常用开发者工具箱与自定义 API/Function 工具。
        </Paragraph>
      </div>

      <Tabs 
        defaultActiveKey="it-tools" 
        items={items} 
      />

      {/* Custom Tool Modal */}
      <Modal
        title={editingTool ? '编辑工具' : '添加工具'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入工具名称' }]}>
            <Input placeholder="例如：天气查询工具" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择工具类型' }]}>
            <Select>
              <Select.Option value="api">API</Select.Option>
              <Select.Option value="function">Function</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="工具描述..." />
          </Form.Item>
          <Form.Item name="config" label="配置 (JSON)" rules={[{ required: true, message: '请输入配置' }]}>
            <Input.TextArea rows={10} style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* IT-Tools Iframe Modal */}
      <Modal
        title={null}
        open={!!iframeUrl}
        onCancel={() => setIframeUrl(null)}
        footer={null}
        width="90%"
        style={{ top: 20 }}
        bodyStyle={{ padding: 0, height: '85vh' }}
        destroyOnClose
      >
        {iframeUrl && (
          <iframe
            src={iframeUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="IT Tool"
          />
        )}
      </Modal>
    </div>
  );
};

export default ToolManager;
