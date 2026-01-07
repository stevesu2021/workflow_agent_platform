import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface Agent {
  key: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  updatedAt: string;
}

const AgentList: React.FC = () => {
  const navigate = useNavigate();
  // Mock data for now
  const [data, setData] = useState<Agent[]>([
    {
      key: '1',
      name: 'Customer Support Bot',
      description: 'Handles general inquiries and refunds.',
      status: 'active',
      updatedAt: '2023-10-25',
    },
    {
      key: '2',
      name: 'Data Analysis Agent',
      description: 'Analyzes sales data and generates reports.',
      status: 'inactive',
      updatedAt: '2023-10-20',
    },
  ]);

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
      dataIndex: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'volcano'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => navigate(`/studio/${record.key}`)}>Edit</Button>
          <Button icon={<DeleteOutlined />} danger>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>My Agents</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/studio')}>
          Create New Agent
        </Button>
      </div>
      <Table columns={columns} dataSource={data} />
    </div>
  );
};

export default AgentList;
