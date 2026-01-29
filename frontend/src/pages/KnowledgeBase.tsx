import React, { useEffect, useState, useMemo } from 'react';
import { Button, Table, Modal, Form, Input, message, Space, Tag, Typography, Tooltip, Select, Layout, Menu, Dropdown, Empty } from 'antd';
import { 
  PlusOutlined, DeleteOutlined, BookOutlined, CloudUploadOutlined, CloudDownloadOutlined, 
  GlobalOutlined, RocketOutlined, FileTextOutlined, TableOutlined, PartitionOutlined,
  FolderOutlined, FolderAddOutlined, MoreOutlined, EditOutlined, FolderOpenOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { knowledgeApi } from '../api/knowledge';
import type { KnowledgeBase, KnowledgeBaseGroup } from '../types/knowledge';
import KnowledgeBaseUsageModal from '../components/KnowledgeBaseUsageModal';

const { Paragraph } = Typography;
const { Sider, Content } = Layout;

const KnowledgeBaseList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KnowledgeBase[]>([]);
  const [groups, setGroups] = useState<KnowledgeBaseGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isAddToGroupModalOpen, setIsAddToGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<KnowledgeBaseGroup | null>(null);
  
  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [currentKnowledgeBase, setCurrentKnowledgeBase] = useState<KnowledgeBase | null>(null);
  
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();
  const [addToGroupForm] = Form.useForm();
  
  const navigate = useNavigate();

  const fetchGroups = async () => {
    try {
      const result = await knowledgeApi.listGroups();
      setGroups(result);
    } catch (error) {
      message.error('加载分组失败');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await knowledgeApi.list(selectedGroupId || undefined);
      setData(result);
    } catch (error) {
      message.error('加载知识库失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedGroupId]);

  const handleCreate = async (values: any) => {
    try {
      await knowledgeApi.create({
        ...values,
        type: values.type || 'text',
        group_id: selectedGroupId || undefined
      });
      message.success('知识库创建成功');
      setIsModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('创建知识库失败');
    }
  };

  const handleCreateGroup = async (values: any) => {
    try {
      if (editingGroup) {
        await knowledgeApi.updateGroup(editingGroup.id, values);
        message.success('分组更新成功');
      } else {
        await knowledgeApi.createGroup(values);
        message.success('分组创建成功');
      }
      setIsGroupModalOpen(false);
      groupForm.resetFields();
      setEditingGroup(null);
      fetchGroups();
    } catch (error) {
      message.error(editingGroup ? '更新分组失败' : '创建分组失败');
    }
  };

  const handleDeleteGroup = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: '确定要删除该分组吗？',
      content: '删除分组不会删除其中的知识库，它们将变为未分组状态。',
      onOk: async () => {
        try {
          await knowledgeApi.deleteGroup(id);
          message.success('分组已删除');
          if (selectedGroupId === id) {
            setSelectedGroupId(null);
          }
          fetchGroups();
        } catch (error) {
          message.error('删除分组失败');
        }
      }
    });
  };

  const handleAddToGroup = async (values: any) => {
    try {
      const groupId = values.group_id === 'none' ? null : values.group_id;
      
      // Update each selected KB
      for (const id of selectedRowKeys) {
        await knowledgeApi.update(id as string, { group_id: groupId });
      }
      
      message.success('已更新分组');
      setIsAddToGroupModalOpen(false);
      addToGroupForm.resetFields();
      setSelectedRowKeys([]);
      fetchData();
    } catch (error) {
      message.error('更新分组失败');
    }
  };
  
  const handleRemoveFromGroup = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await knowledgeApi.update(id, { group_id: undefined }); // Remove from group
      message.success('已从分组移除');
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
        title: '确定要删除该知识库吗？',
        content: '此操作不可撤销。',
        onOk: async () => {
            try {
                await knowledgeApi.delete(id);
                message.success('知识库已删除');
                fetchData();
            } catch (error) {
                message.error('删除知识库失败');
            }
        }
    });
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) return;
    
    Modal.confirm({
      title: `确定要删除选中的 ${selectedRowKeys.length} 个知识库吗？`,
      content: '此操作不可撤销，且会删除关联的所有文档和向量数据。',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await knowledgeApi.batchDelete(selectedRowKeys as string[]);
          message.success('批量删除成功');
          setSelectedRowKeys([]);
          fetchData();
        } catch (error) {
          message.error('批量删除失败');
        }
      },
    });
  };

  const handlePublish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await knowledgeApi.publish(id);
      message.success('知识库已发布');
      fetchData();
    } catch (error) {
      message.error('发布知识库失败');
    }
  };

  const handleUnpublish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await knowledgeApi.unpublish(id);
      message.success('知识库已取消发布');
      fetchData();
    } catch (error) {
      message.error('取消发布知识库失败');
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
      title: '分组',
      dataIndex: 'group_name',
      key: 'group_name',
      render: (text: string) => text ? <Tag icon={<FolderOutlined />}>{text}</Tag> : <span style={{ color: '#ccc' }}>未分组</span>
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
      title: '操作',
      key: 'action',
      render: (_: any, record: KnowledgeBase) => (
        <Space size="small">
          {record.is_published ? (
            <Tooltip title="使用">
              <Button type="text" onClick={(e) => handleShowUsage(record, e)} icon={<RocketOutlined />} />
            </Tooltip>
          ) : (
            <Tooltip title="发布">
              <Button type="text" onClick={(e) => handlePublish(record.id, e)} icon={<CloudUploadOutlined />} />
            </Tooltip>
          )}
          
          {selectedGroupId && (
             <Tooltip title="从分组移除">
               <Button type="text" onClick={(e) => handleRemoveFromGroup(record.id, e)} icon={<DeleteOutlined rotate={45} />} />
             </Tooltip>
          )}

          <Tooltip title="删除">
            <Button type="text" danger onClick={(e) => handleDelete(record.id, e)} icon={<DeleteOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ], [selectedGroupId]);

  const groupMenu = (
    <Menu
      items={[
        {
          key: 'all',
          label: '全部知识库',
          icon: <BookOutlined />,
          onClick: () => setSelectedGroupId(null),
        },
        ...groups.map(group => ({
          key: group.id,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>{group.name}</span>
              <Space onClick={(e) => e.stopPropagation()}>
                <EditOutlined onClick={() => {
                  setEditingGroup(group);
                  groupForm.setFieldsValue(group);
                  setIsGroupModalOpen(true);
                }} />
                <DeleteOutlined onClick={(e) => handleDeleteGroup(group.id, e)} />
              </Space>
            </div>
          ),
          icon: <FolderOutlined />,
          onClick: () => setSelectedGroupId(group.id),
        }))
      ]}
      selectedKeys={[selectedGroupId || 'all']}
    />
  );

  return (
    <Layout style={{ background: '#fff' }}>
      <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: '16px 0' }}>
        <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>分组列表</h3>
          <Button 
            type="text" 
            icon={<PlusOutlined />} 
            onClick={() => {
              setEditingGroup(null);
              groupForm.resetFields();
              setIsGroupModalOpen(true);
            }} 
          />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedGroupId || 'all']}
          style={{ borderRight: 0 }}
          items={[
            {
              key: 'all',
              label: '全部知识库',
              icon: <BookOutlined />,
              onClick: () => setSelectedGroupId(null),
            },
            ...groups.map(group => ({
              key: group.id,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{group.name}</span>
                  <Dropdown 
                    menu={{ 
                      items: [
                        { key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: (e) => {
                          e.domEvent.stopPropagation();
                          setEditingGroup(group);
                          groupForm.setFieldsValue(group);
                          setIsGroupModalOpen(true);
                        }},
                        { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: (e) => {
                          e.domEvent.stopPropagation();
                          handleDeleteGroup(group.id, e as any);
                        }}
                      ] 
                    }} 
                    trigger={['click']}
                  >
                    <MoreOutlined onClick={(e) => e.stopPropagation()} />
                  </Dropdown>
                </div>
              ),
              icon: <FolderOutlined />,
              onClick: () => setSelectedGroupId(group.id),
            }))
          ]}
        />
      </Sider>
      
      <Content style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2>{selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.name : '全部知识库'}</h2>
          <Space>
            {selectedRowKeys.length > 0 && (
              <>
                <Button icon={<FolderOpenOutlined />} onClick={() => setIsAddToGroupModalOpen(true)}>
                  添加到分组
                </Button>
                <Button 
                  danger 
                  icon={<DeleteOutlined />} 
                  onClick={handleBatchDelete}
                >
                  批量删除 ({selectedRowKeys.length})
                </Button>
              </>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
              创建知识库
            </Button>
          </Space>
        </div>

        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="id" 
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          onRow={(record) => ({
            onClick: () => {
               navigate(`/knowledge/${record.id}`)
            },
            style: { cursor: 'pointer' }
          })}
        />

        {/* Create Knowledge Base Modal */}
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
            {selectedGroupId && (
               <Form.Item label="所属分组">
                 <Tag icon={<FolderOutlined />}>{groups.find(g => g.id === selectedGroupId)?.name}</Tag>
               </Form.Item>
            )}
          </Form>
        </Modal>

        {/* Create/Edit Group Modal */}
        <Modal
          title={editingGroup ? "编辑分组" : "创建分组"}
          open={isGroupModalOpen}
          onOk={() => groupForm.submit()}
          onCancel={() => {
            setIsGroupModalOpen(false);
            setEditingGroup(null);
            groupForm.resetFields();
          }}
        >
          <Form form={groupForm} onFinish={handleCreateGroup} layout="vertical">
            <Form.Item name="name" label="分组名称" rules={[{ required: true, message: '请输入分组名称' }]}>
              <Input placeholder="例如：项目文档、技术资料" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea placeholder="请输入分组描述" rows={3} />
            </Form.Item>
          </Form>
        </Modal>
        
        {/* Add to Group Modal */}
        <Modal
          title="添加到分组"
          open={isAddToGroupModalOpen}
          onOk={() => addToGroupForm.submit()}
          onCancel={() => setIsAddToGroupModalOpen(false)}
        >
          <Form form={addToGroupForm} onFinish={handleAddToGroup} layout="vertical">
            <Form.Item name="group_id" label="选择分组" rules={[{ required: true, message: '请选择分组' }]}>
              <Select placeholder="请选择目标分组">
                <Select.Option value="none">
                  <span style={{ color: '#999' }}>-- 移除分组 --</span>
                </Select.Option>
                {groups.map(group => (
                  <Select.Option key={group.id} value={group.id}>
                    <FolderOutlined /> {group.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <div style={{ marginBottom: 16 }}>
              已选择 {selectedRowKeys.length} 个知识库
            </div>
          </Form>
        </Modal>

        <KnowledgeBaseUsageModal 
          visible={usageModalVisible} 
          knowledgeBase={currentKnowledgeBase} 
          onCancel={() => setUsageModalVisible(false)} 
        />
      </Content>
    </Layout>
  );
};

export default KnowledgeBaseList;
