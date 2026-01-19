import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Space, Tag, message, Dropdown, Card, Row, Col, Statistic } from 'antd';
import type { ColumnsType, MenuProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExportOutlined, DownOutlined, RobotOutlined, NodeIndexOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { agentsApi } from '../api/agents';
import type { Agent } from '../types/agent';

const AgentList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Agent[]>([]);
  const [filteredData, setFilteredData] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'agentic' | 'workflow'>('all');

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const agents = await agentsApi.getAll();
      setData(agents);
      setFilteredData(agents);
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

  // Filter data by type
  useEffect(() => {
    if (typeFilter === 'all') {
      setFilteredData(data);
    } else {
      setFilteredData(data.filter(agent => agent.type === typeFilter));
    }
  }, [typeFilter, data]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: data.length,
      agentic: data.filter(a => a.type === 'agentic').length,
      workflow: data.filter(a => a.type === 'workflow').length,
    };
  }, [data]);

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
      render: (text, record) => (
        <a
          onClick={() => handleEdit(record)}
          style={{
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          {record.type === 'agentic' && <RobotOutlined style={{ color: '#722ed1' }} />}
          {record.type === 'workflow' && <NodeIndexOutlined style={{ color: '#1890ff' }} />}
          {text}
        </a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      filters: [
        { text: 'Agentic', value: 'agentic' },
        { text: 'Workflow', value: 'workflow' },
      ],
      render: (type) => (
        <Tag
          icon={type === 'agentic' ? <RobotOutlined /> : <NodeIndexOutlined />}
          color={type === 'agentic' ? 'purple' : 'blue'}
          style={{ fontSize: 13, padding: '4px 10px' }}
        >
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
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>智能体管理</h2>
        <Dropdown menu={{ items: createMenuItems }} trigger={['click']}>
          <Button type="primary" icon={<PlusOutlined />}>
            创建智能体 <DownOutlined />
          </Button>
        </Dropdown>
      </div>

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="智能体总数"
              value={stats.total}
              prefix={<ApartmentOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Agentic 智能体"
              value={stats.agentic}
              prefix={<RobotOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Workflow 智能体"
              value={stats.workflow}
              prefix={<NodeIndexOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Buttons */}
      <Space style={{ marginBottom: 16 }}>
        <Button
          type={typeFilter === 'all' ? 'primary' : 'default'}
          onClick={() => setTypeFilter('all')}
        >
          全部 ({stats.total})
        </Button>
        <Button
          type={typeFilter === 'agentic' ? 'primary' : 'default'}
          icon={<RobotOutlined />}
          onClick={() => setTypeFilter('agentic')}
          style={typeFilter === 'agentic' ? { backgroundColor: '#722ed1', borderColor: '#722ed1' } : {}}
        >
          Agentic ({stats.agentic})
        </Button>
        <Button
          type={typeFilter === 'workflow' ? 'primary' : 'default'}
          icon={<NodeIndexOutlined />}
          onClick={() => setTypeFilter('workflow')}
          style={typeFilter === 'workflow' ? { backgroundColor: '#1890ff', borderColor: '#1890ff' } : {}}
        >
          Workflow ({stats.workflow})
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="id"
        loading={loading}
        onRow={(record) => ({
          onDoubleClick: () => handleEdit(record),
          style: { cursor: 'pointer' }
        })}
      />
    </div>
  );
};

export default AgentList;
