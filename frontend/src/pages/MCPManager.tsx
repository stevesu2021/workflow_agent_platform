import React, { useEffect, useState } from 'react';
import { Button, Modal, Form, Input, Card, Row, Col, Typography, Empty, Space, Tag, message, Drawer, List, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined, CodeOutlined } from '@ant-design/icons';
import { getMCPServers, createMCPServer, updateMCPServer, deleteMCPServer, listMCPServerTools } from '../api/mcp';
import type { MCPServer, MCPServerCreate, MCPTool } from '../api/mcp';

const { Title, Paragraph, Text } = Typography;

const MCPManager: React.FC = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  
  // Tools Drawer State
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentServerTools, setCurrentServerTools] = useState<MCPTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [currentServerName, setCurrentServerName] = useState('');

  const [form] = Form.useForm();

  const fetchServers = async () => {
    setLoading(true);
    try {
      const data = await getMCPServers();
      setServers(data);
    } catch (error) {
      message.error('Failed to fetch MCP servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleAdd = () => {
    setEditingServer(null);
    form.resetFields();
    form.setFieldsValue({
      config: JSON.stringify({
        command: "npx",
        args: [],
        env: {}
      }, null, 2)
    });
    setModalVisible(true);
  };

  const handleEdit = (server: MCPServer) => {
    setEditingServer(server);
    form.setFieldsValue({
      name: server.name,
      description: server.description,
      config: JSON.stringify(server.config, null, 2)
    });
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this MCP Server?',
      content: 'This action cannot be undone.',
      onOk: async () => {
        try {
          await deleteMCPServer(id);
          message.success('MCP Server deleted successfully');
          fetchServers();
        } catch (error) {
          message.error('Failed to delete MCP Server');
        }
      }
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      console.log("Form values:", values); // Debug log

      let rawConfig;
      try {
        rawConfig = JSON.parse(values.config);
      } catch (e: any) {
        console.error("JSON Parse Error:", e);
        message.error(`JSON 格式错误: ${e.message}`);
        return;
      }

      // Support Claude Desktop style config (extract the first server config if nested)
      let config = rawConfig;
      if (rawConfig.mcpServers) {
        const serverKeys = Object.keys(rawConfig.mcpServers);
        if (serverKeys.length > 0) {
          // Use the first server found in mcpServers
          config = rawConfig.mcpServers[serverKeys[0]];
        }
      }
      
      console.log("Parsed Config:", config); // Debug log

      if (!config.command) {
        console.error("Missing command field");
        message.error("配置必须包含 'command' 字段 (例如: npx, python)");
        return;
      }

      const serverData: MCPServerCreate = {
        name: values.name,
        description: values.description,
        config: config
      };
      
      console.log("Sending server data:", serverData); // Debug log

      if (editingServer) {
        await updateMCPServer(editingServer.id, serverData);
        message.success('MCP Server updated successfully');
      } else {
        await createMCPServer(serverData);
        message.success('MCP Server created successfully');
      }

      setModalVisible(false);
      fetchServers();
    } catch (error: any) {
      console.error("Submit Error:", error);
      // Check if it's a validation error (Ant Design Form)
      if (error.errorFields) {
        // Form validation failed, do nothing as Ant Design shows errors inline
        return;
      }
      message.error(`Operation failed: ${error.message || 'Unknown error'}`);
    }
  };

  const handleViewTools = async (server: MCPServer) => {
    setCurrentServerName(server.name);
    setDrawerVisible(true);
    setToolsLoading(true);
    try {
      const tools = await listMCPServerTools(server.id);
      setCurrentServerTools(tools);
    } catch (error: any) {
      message.error(`Failed to list tools: ${error.response?.data?.detail || error.message}`);
      setCurrentServerTools([]);
    } finally {
      setToolsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2}>MCP Servers</Title>
          <Paragraph type="secondary">
            Manage Model Context Protocol (MCP) servers and explore their capabilities.
          </Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Server
        </Button>
      </div>

      {loading ? (
        <Spin size="large" />
      ) : servers.length > 0 ? (
        <Row gutter={[16, 16]}>
          {servers.map(server => (
            <Col xs={24} sm={12} md={8} lg={6} key={server.id}>
              <Card
                title={server.name}
                extra={
                  <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(server)} />
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(server.id)} />
                  </Space>
                }
                actions={[
                  <Button type="link" icon={<ApiOutlined />} onClick={() => handleViewTools(server)}>
                    View Tools
                  </Button>
                ]}
              >
                <Paragraph ellipsis={{ rows: 2 }}>{server.description || 'No description'}</Paragraph>
                <div style={{ marginBottom: 8 }}>
                  <Tag icon={<CodeOutlined />} color="blue">
                    {server.config.command}
                  </Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Empty description="No MCP Servers found" />
      )}

      {/* Add/Edit Modal */}
      <Modal
        title={editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter server name' }]}>
            <Input placeholder="e.g., Filesystem Server" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Description..." />
          </Form.Item>
          <Form.Item 
            name="config" 
            label="Configuration (JSON)" 
            rules={[{ required: true, message: 'Please enter configuration' }]}
            help='Example: { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"], "env": {} }'
          >
            <Input.TextArea rows={8} style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Tools Drawer */}
      <Drawer
        title={`Tools provided by ${currentServerName}`}
        placement="right"
        width={600}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
        {toolsLoading ? (
          <div style={{ textAlign: 'center', marginTop: 50 }}>
            <Spin size="large" tip="Connecting to MCP Server..." />
          </div>
        ) : (
          <List
            itemLayout="vertical"
            dataSource={currentServerTools}
            renderItem={tool => (
              <List.Item>
                <List.Item.Meta
                  title={<Text strong>{tool.name}</Text>}
                  description={tool.description}
                />
                <Card size="small" title="Input Schema" style={{ marginTop: 10, background: '#f5f5f5' }}>
                  <pre style={{ fontSize: 12, overflow: 'auto' }}>
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                </Card>
              </List.Item>
            )}
            locale={{ emptyText: 'No tools found on this server' }}
          />
        )}
      </Drawer>
    </div>
  );
};

export default MCPManager;
