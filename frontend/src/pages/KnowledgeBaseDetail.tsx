import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Table, Upload, message, Input, List, Tag, Tabs, Space, Divider, Typography, Modal, Tooltip, InputNumber } from 'antd';
import { UploadOutlined, SearchOutlined, ArrowLeftOutlined, ReloadOutlined, DownloadOutlined, FileMarkdownOutlined } from '@ant-design/icons';
import { knowledgeApi } from '../api/knowledge';
import type { KnowledgeBase, Document, SearchResult } from '../types/knowledge';

const { Title, Paragraph } = Typography;

const KnowledgeBaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTopK, setSearchTopK] = useState(10);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [chunksVisible, setChunksVisible] = useState(false);
  const [chunksList, setChunksList] = useState<SearchResult[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  // Polling for processing status
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const hasProcessingDocs = kb?.documents.some(doc => doc.status === 'processing');
    
    if (hasProcessingDocs) {
      intervalId = setInterval(() => {
        // Fetch silently (without setting global loading state to avoid flickering)
        if (!id) return;
        knowledgeApi.get(id).then(result => {
           setKb(result);
        }).catch(err => console.error("Polling error", err));
      }, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [kb, id]);

  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const fetchKb = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await knowledgeApi.get(id);
      setKb(result);
    } catch (error) {
      console.error('Failed to load KB:', error);
      message.error('Failed to load Knowledge Base');
      navigate('/knowledge');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKb();
  }, [id]);

  const handleUpload = async (file: File) => {
    if (!id) return false;
    setUploading(true);
    try {
      await knowledgeApi.uploadDocument(id, file);
      message.success('File uploaded successfully');
      fetchKb();
    } catch (error) {
      message.error('Upload failed');
    } finally {
      setUploading(false);
    }
    return false; // Prevent default upload behavior
  };

  const handleProcess = async (docId: string) => {
    if (!id) return;
    try {
      await knowledgeApi.processDocument(id, docId);
      message.success('Processing started');
      fetchKb();
    } catch (error) {
      message.error('Failed to start processing');
    }
  };

  const handleViewChunks = async (doc: Document) => {
    if (!id) return;
    setChunksLoading(true);
    setChunksVisible(true);
    try {
      const results = await knowledgeApi.getDocumentChunks(id, doc.id);
      // Sort by chunk_id if possible. chunk_id is like "docId_index"
      results.sort((a, b) => {
          const idxA = parseInt(a.id.split('_').pop() || '0');
          const idxB = parseInt(b.id.split('_').pop() || '0');
          return idxA - idxB;
      });
      setChunksList(results);
    } catch (error) {
      message.error('Failed to load chunks');
    } finally {
      setChunksLoading(false);
    }
  };

  const handlePreview = async (doc: Document) => {
    if (!id) return;
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewVisible(true);
    try {
      const data = await knowledgeApi.getDocumentPreview(id, doc.id);
      setPreviewContent(data.content);
    } catch (error) {
      message.error('Failed to load preview');
      setPreviewContent('Error loading content.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!id || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await knowledgeApi.search(id, searchQuery, searchTopK);
      // Sort results by score (descending if higher is better, ascending if lower is better)
      // Since backend returns L2 distance (lower is better), but users usually expect "similarity" (higher is better),
      // we need to clarify what "score" means.
      // If score is L2 distance, lower is better. 
      // If we want to show "most relevant first", we should sort by score ASCENDING (smallest distance first).
      // BUT user asked for "Sort by Score Descending".
      // If user sees score > 1, they know it's distance? Or maybe they think it's relevance?
      // "按照Score倒序排列" -> Descending order.
      // If it is L2 distance, descending order means "least similar first". That's weird for search.
      // Unless user THINKS higher score = better match.
      // Let's assume user wants "Best Match First".
      // For L2 distance, Best Match = Lowest Score. So we should sort ASCENDING.
      // However, if user explicitly asked for "Score Descending", maybe they want to see large distances?
      // Or maybe they mistakenly think high score = good.
      // Let's implement what is requested: "Score Descending".
      // Wait, if I change the sort order, I should also explain or normalize.
      // If I sort descending, I get the worst matches first (for L2).
      // Let's double check if I can normalize it or if I should just sort ascending (best first).
      // Usually "Search Results" implies best first.
      // If I sort by score DESC, I get 1.5, 1.4, 1.2...
      // If I sort by score ASC, I get 0.5, 0.6, 0.8...
      // User query: "Search到的结果要按照Score倒序排列" (Search results should be sorted by Score Descending).
      // If the user assumes "Score" is similarity, then Descending is correct (High to Low).
      // But since our Score is L2 Distance, High to Low means "Far to Near".
      // I will implement Descending as requested, but I suspect user wants "Best Match".
      // But wait, standard vector search usually returns "Nearest Neighbors" (Top K).
      // Top K by definition are the K items with SMALLEST distance (for L2) or LARGEST similarity (for IP).
      // The backend `vector_service.search` returns `similarity_search_with_score`.
      // For L2, it returns the K items with smallest distance.
      // So the list returned by backend IS ALREADY SORTED by "Best Match" (Smallest Distance).
      // If I sort them Descending (Largest Distance First), I am reversing the order of relevance.
      // Unless... user changed metric type to IP? No, I checked and it is L2 (default).
      
      // Let's assume the user WANTS to see the "Best Match" first, and assumes "Score" means similarity (Higher is better).
      // But since it is L2, the "Best Match" has the LOWEST score.
      // If I sort Descending, I show the WORST match of the top K first.
      
      // However, strict instruction following: "按照Score倒序排列".
      // I will do: `results.sort((a, b) => b.score - a.score);`
      
      // WAIT. If the backend returns top K best matches, they are [0.2, 0.3, 0.4...].
      // If I sort descending, I get [0.4, 0.3, 0.2].
      // Maybe user wants to see them this way?
      
      // Actually, if I change the metric to IP as discussed in the "reasoning" part of the previous turn (which I didn't execute yet),
      // then Score > 1 issue is solved (if normalized) AND Descending sort is correct.
      // But I haven't changed the backend to IP yet.
      
      // Let's just implement the sort as requested in frontend first.
      const results = response.results;
      results.sort((a, b) => b.score - a.score);
      setSearchResults(results);
    } catch (error) {
      message.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const columns = [
    {
      title: 'Filename',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: 'Type',
      dataIndex: 'file_type',
      key: 'file_type',
      render: (text: string) => <Tag>{text.toUpperCase()}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Document) => {
        let color = 'default';
        if (status === 'completed') color = 'success';
        if (status === 'processing') color = 'processing';
        if (status === 'error') color = 'error';
        
        const tag = <Tag color={color}>{status.toUpperCase()}</Tag>;
        
        if (status === 'error' && record.error_message) {
            return (
                <Tooltip title={record.error_message}>
                    {tag}
                </Tooltip>
            );
        }
        return tag;
      }
    },
    {
      title: 'Chunks',
      dataIndex: 'chunk_count',
      key: 'chunk_count',
      render: (count: number, record: Document) => (
        <a onClick={() => handleViewChunks(record)}>{count}</a>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Document) => (
        <Space>
           {record.status === 'pending' || record.status === 'error' ? (
             <Button size="small" type="primary" onClick={() => handleProcess(record.id)}>Process</Button>
           ) : null}
           {record.status === 'completed' ? (
             <Button size="small" onClick={() => handleProcess(record.id)}>Reindex</Button>
           ) : null}
           {record.status === 'processing' ? (
             <Tag icon={<ReloadOutlined spin />} color="processing">Processing</Tag>
           ) : null}
           <Button size="small" onClick={() => handlePreview(record)}>Preview</Button>
           <Tooltip title="Download Original">
             <Button 
                size="small" 
                icon={<DownloadOutlined />} 
                onClick={() => window.open(`/api/knowledge-bases/${id}/documents/${record.id}/file?download=true`, '_blank')}
             />
           </Tooltip>
           {record.status === 'completed' ? (
             <Tooltip title="Download Markdown">
                <Button 
                    size="small" 
                    icon={<FileMarkdownOutlined />} 
                    onClick={() => window.open(`/api/knowledge-bases/${id}/documents/${record.id}/markdown`, '_blank')}
                />
             </Tooltip>
           ) : null}
        </Space>
      ),
    },
  ];

  if (!kb) return <div>Loading...</div>;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge')} style={{ marginBottom: 16 }}>
        Back to List
      </Button>
      
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <Title level={3}>{kb.name}</Title>
                <Paragraph>{kb.description}</Paragraph>
            </div>
            <Upload 
                beforeUpload={handleUpload} 
                showUploadList={false}
                accept=".pdf,.txt,.md,.docx"
            >
                <Button icon={<UploadOutlined />} loading={uploading} type="primary">Upload Document</Button>
            </Upload>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Tabs defaultActiveKey="1" items={[
            {
                key: '1',
                label: 'Documents',
                children: (
                    <Table 
                        columns={columns} 
                        dataSource={kb.documents} 
                        rowKey="id" 
                        loading={loading}
                    />
                )
            },
            {
                key: '2',
                label: 'Search Playground',
                children: (
                    <Card>
                        <Space.Compact style={{ width: '100%' }}>
                            <Input 
                                placeholder="Enter your query..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onPressEnter={handleSearch}
                            />
                            <InputNumber 
                                min={1} 
                                max={100} 
                                value={searchTopK} 
                                onChange={(value) => setSearchTopK(value || 10)} 
                                style={{ width: 80 }}
                                placeholder="Top K"
                            />
                            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={searching}>Search</Button>
                        </Space.Compact>
                        
                        <Divider />
                        
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {searchResults.map((item) => (
                                    <Card key={`${item.id}-${Math.random()}`} size="small">
                                        <Card.Meta
                                            title={`Score: ${item.score.toFixed(4)}`}
                                            description={item.content}
                                        />
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>Source: {item.metadata.source}</div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </Card>
                )
            }
        ]} />
      </div>

      <Modal
        title="Document Chunks"
        open={chunksVisible}
        onCancel={() => setChunksVisible(false)}
        footer={null}
        width={800}
      >
        <Table
            loading={chunksLoading}
            dataSource={chunksList}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            columns={[
                {
                    title: 'ID',
                    dataIndex: 'id',
                    width: 100,
                    render: (id: string) => {
                        // Extract index from "docId_index"
                        const parts = id.split('_');
                        return parts.length > 1 ? parts.pop() : id;
                    }
                },
                {
                    title: 'Content',
                    dataIndex: 'content',
                    render: (text: string) => (
                        <div style={{ maxHeight: 100, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                            {text}
                        </div>
                    )
                }
            ]}
        />
      </Modal>

      <Modal
        title="Document Preview"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={1200}
      >
        {previewLoading ? (
          <div>Loading...</div>
        ) : (
          <div style={{ display: 'flex', gap: '16px', height: '70vh' }}>
            <div style={{ flex: 1, border: '1px solid #eee' }}>
                {previewDoc?.file_type === 'pdf' ? (
                   <iframe 
                        src={`/api/knowledge-bases/${id}/documents/${previewDoc.id}/file`} 
                        width="100%" 
                        height="100%" 
                        style={{ border: 'none' }}
                        title="PDF Preview"
                   />
                ) : (
                   <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
                        Original file preview only available for PDF.
                        <br/>
                        Current file type: {previewDoc?.file_type}
                   </div>
                )}
            </div>
            <div style={{ flex: 1, border: '1px solid #eee', overflowY: 'auto', padding: '16px', backgroundColor: '#f9f9f9' }}>
                <Title level={5}>Parsed Markdown</Title>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {previewContent}
                </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default KnowledgeBaseDetail;
