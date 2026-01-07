import React, { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, message, Space, Tag, Typography, Tooltip } from 'antd';
import { PlusOutlined, BookOutlined, CloudUploadOutlined, CloudDownloadOutlined, GlobalOutlined, RocketOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { knowledgeApi } from '../api/knowledge';
import type { KnowledgeBase } from '../types/knowledge';
import KnowledgeBaseUsageModal from '../components/KnowledgeBaseUsageModal';

const { Paragraph } = Typography;

const KnowledgeBaseList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KnowledgeBase[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [currentKnowledgeBase, setCurrentKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await knowledgeApi.list();
      setData(result);
    } catch (error) {
      message.error('Failed to load knowledge bases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await knowledgeApi.create(values);
      message.success('Knowledge Base created');
      setIsModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('Failed to create Knowledge Base');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
        title: 'Are you sure you want to delete this Knowledge Base?',
        content: 'This action cannot be undone.',
        onOk: async () => {
            try {
                await knowledgeApi.delete(id);
                message.success('Knowledge Base deleted');
                fetchData();
            } catch (error) {
                message.error('Failed to delete Knowledge Base');
            }
        }
    });
  };

  const handlePublish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await knowledgeApi.publish(id);
      message.success('Knowledge Base published');
      fetchData();
    } catch (error) {
      message.error('Failed to publish Knowledge Base');
    }
  };

  const handleUnpublish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await knowledgeApi.unpublish(id);
      message.success('Knowledge Base unpublished');
      fetchData();
    } catch (error) {
      message.error('Failed to unpublish Knowledge Base');
    }
  };

  const handleShowUsage = (record: KnowledgeBase, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentKnowledgeBase(record);
    setUsageModalVisible(true);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <><BookOutlined /> {text}</>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: KnowledgeBase) => (
        record.is_published ? (
          <Tag color="success" icon={<GlobalOutlined />}>Published</Tag>
        ) : (
          <Tag color="default">Unpublished</Tag>
        )
      ),
    },
    {
      title: 'Documents',
      dataIndex: 'document_count',
      key: 'document_count',
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'API Endpoint',
      key: 'api',
      render: (_: any, record: KnowledgeBase) => (
        record.is_published ? (
          <Paragraph copyable={{ text: `${window.location.origin}/api/knowledge-bases/${record.id}/search` }} style={{ marginBottom: 0 }}>
             <Tooltip title="Copy API Endpoint">
               <Tag color="blue">POST /api/knowledge-bases/{record.id}/search</Tag>
             </Tooltip>
          </Paragraph>
        ) : <span style={{ color: '#ccc' }}>Not Available</span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: KnowledgeBase) => (
        <Space size="middle">
          {record.is_published ? (
            <>
              <Button type="link" onClick={(e) => handleShowUsage(record, e)} icon={<RocketOutlined />}>Usage</Button>
              <Button type="link" onClick={(e) => handleUnpublish(record.id, e)} icon={<CloudDownloadOutlined />}>Unpublish</Button>
            </>
          ) : (
            <Button type="link" onClick={(e) => handlePublish(record.id, e)} icon={<CloudUploadOutlined />}>Publish</Button>
          )}
          <Button type="link" danger onClick={(e) => handleDelete(record.id, e)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Knowledge Bases</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          Create Knowledge Base
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        onRow={(record) => ({
          onClick: () => {
             navigate(`/knowledge/${record.id}`)
          },
          style: { cursor: 'pointer' }
        })}
      />

      <Modal
        title="Create Knowledge Base"
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      <KnowledgeBaseUsageModal 
        visible={usageModalVisible} 
        knowledgeBase={currentKnowledgeBase} 
        onCancel={() => setUsageModalVisible(false)} 
      />
    </div>
  );
};

export default KnowledgeBaseList;
