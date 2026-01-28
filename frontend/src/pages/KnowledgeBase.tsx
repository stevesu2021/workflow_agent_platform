import React, { useEffect, useState, useMemo } from 'react';
import { Button, Table, Modal, Form, Input, message, Space, Tag, Typography, Tooltip, Select } from 'antd';
import { PlusOutlined, BookOutlined, CloudUploadOutlined, CloudDownloadOutlined, GlobalOutlined, RocketOutlined, FileTextOutlined, TableOutlined, PartitionOutlined } from '@ant-design/icons';
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
      await knowledgeApi.create({
        ...values,
        type: values.type || 'text'
      });
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

  const columns = useMemo(() => [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: KnowledgeBase) => (
        <>
          {record.type === 'excel' ? <TableOutlined /> :
           record.type === 'pageindex' ? <PartitionOutlined /> :
           <FileTextOutlined />} {text}
        </>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        type === 'excel' ? (
          <Tag color="blue" icon={<TableOutlined />}>Excel表格</Tag>
        ) : type === 'pageindex' ? (
          <Tag color="purple" icon={<PartitionOutlined />}>PageIndex</Tag>
        ) : (
          <Tag color="green" icon={<FileTextOutlined />}>文本</Tag>
        )
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
      render: (_: any, record: KnowledgeBase) => (
        record.is_published ? (
          <Tag color="success" icon={<GlobalOutlined />}>已发布</Tag>
        ) : (
          <Tag color="default">未发布</Tag>
        )
      ),
    },
    {
      title: '文档数',
      dataIndex: 'document_count',
      key: 'document_count',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'API 端点',
      key: 'api',
      render: (_: any, record: KnowledgeBase) => (
        record.is_published ? (
          <Paragraph copyable={{ text: `${window.location.origin}/api/knowledge-bases/${record.id}/search` }} style={{ marginBottom: 0 }}>
             <Tooltip title="复制 API 端点">
               <Tag color="blue">POST /api/knowledge-bases/{record.id}/search</Tag>
             </Tooltip>
          </Paragraph>
        ) : <span style={{ color: '#ccc' }}>不可用</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: KnowledgeBase) => (
        <Space size="middle">
          {record.is_published ? (
            <>
              <Button type="link" onClick={(e) => handleShowUsage(record, e)} icon={<RocketOutlined />}>使用</Button>
              <Button type="link" onClick={(e) => handleUnpublish(record.id, e)} icon={<CloudDownloadOutlined />}>取消发布</Button>
            </>
          ) : (
            <Button type="link" onClick={(e) => handlePublish(record.id, e)} icon={<CloudUploadOutlined />}>发布</Button>
          )}
          <Button type="link" danger onClick={(e) => handleDelete(record.id, e)}>删除</Button>
        </Space>
      ),
    },
  ], []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>知识库管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          创建知识库
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
        title="创建知识库"
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical" initialValues={{ type: 'text' }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="请输入知识库名称" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="text">
                <FileTextOutlined /> 文本类型 (支持 PDF, DOCX, TXT, MD)
              </Select.Option>
              <Select.Option value="excel">
                <TableOutlined /> Excel表格类型 (支持 XLSX, XLS)
              </Select.Option>
              <Select.Option value="pageindex">
                <PartitionOutlined /> PageIndex (支持 PDF 结构化索引)
              </Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入知识库描述" rows={3} />
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
