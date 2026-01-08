import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
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

  const columns: ColumnsType<Agent> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <a>{text}</a>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Status',
      key: 'status',
      render: () => (
        <Tag color="green">
          ACTIVE
        </Tag>
      ),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => navigate(`/workflow/${record.id}`)}>Edit</Button>
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>My Agents</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/workflow')}>
          Create New Agent
        </Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />
    </div>
  );
};

export default AgentList;
