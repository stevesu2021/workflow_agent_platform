import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Space, Tag, message, Dropdown } from 'antd';
import type { ColumnsType, MenuProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExportOutlined, DownOutlined, RobotOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { agentsApi } from '../api/agents';
import type { Agent } from '../types/agent';

const AgentList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const agents = await agentsApi.getAll();
      setData(agents);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      message.error('Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDelete = async (id: string) => {
      try {
          await agentsApi.delete(id);
          message.success('Agent deleted successfully');
          fetchAgents();
      } catch (error) {
          console.error('Failed to delete agent:', error);
          message.error('Failed to delete agent');
      }
  };

  const handleExport = async (id: string) => {
      try {
          const { yaml, filename } = await agentsApi.exportYaml(id);
          
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

  const handleEdit = (record: Agent) => {
    if (record.type === 'agentic') {
      navigate(`/agentic/${record.id}`);
    } else {
      navigate(`/workflow/${record.id}`);
    }
  };

  const columns = useMemo<ColumnsType<Agent>>(() => [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <a>{text}</a>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag icon={type === 'agentic' ? <RobotOutlined /> : <NodeIndexOutlined />} color={type === 'agentic' ? 'purple' : 'blue'}>
          {type === 'agentic' ? 'Agentic' : 'Workflow'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '状态',
      key: 'status',
      render: () => (
        <Tag color="green">
          活跃
        </Tag>
      ),
    },
    {
      title: '最后更新',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button icon={<ExportOutlined />} onClick={() => handleExport(record.id)}>导出</Button>
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ], [navigate]);

  const createMenuItems: MenuProps['items'] = [
    {
      key: 'workflow',
      label: '工作流编排智能体',
      icon: <NodeIndexOutlined />,
      onClick: () => navigate('/workflow'),
    },
    {
      key: 'agentic',
      label: 'Agentic 智能体',
      icon: <RobotOutlined />,
      onClick: () => navigate('/agentic'),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>智能体管理</h2>
        <Dropdown menu={{ items: createMenuItems }} trigger={['click']}>
          <Button type="primary" icon={<PlusOutlined />}>
            创建智能体 <DownOutlined />
          </Button>
        </Dropdown>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />
    </div>
  );
};

export default AgentList;
