import React, { useState } from 'react';
import { Modal, Button, Input, Space, Typography, Card, message, List, Tag, Spin } from 'antd';
import { SearchOutlined, CodeOutlined, RocketOutlined } from '@ant-design/icons';
import { knowledgeApi } from '../api/knowledge';
import type { KnowledgeBase, SearchResult } from '../types/knowledge';

const { Text, Paragraph } = Typography;

interface KnowledgeBaseUsageModalProps {
  knowledgeBase: KnowledgeBase | null;
  visible: boolean;
  onCancel: () => void;
}

const KnowledgeBaseUsageModal: React.FC<KnowledgeBaseUsageModalProps> = ({ knowledgeBase, visible, onCancel }) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  if (!knowledgeBase) return null;

  const handleSearch = async () => {
    if (!query.trim()) {
      message.warning('Please enter a search query');
      return;
    }
    setLoading(true);
    try {
      const result = await knowledgeApi.search(knowledgeBase.id, query);
      setSearchResults(result.results);
    } catch {
      message.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const curlCommand = `curl -X POST "${window.location.origin}/api/knowledge-bases/${knowledgeBase.id}/search" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "your query here", "top_k": 5}'`;

  return (
    <Modal
      title={
        <Space>
          <RocketOutlined />
          <span>Usage Instructions: {knowledgeBase.name}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="close" onClick={onCancel}>Close</Button>
      ]}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        
        <Card title={<span><CodeOutlined /> API Usage</span>} size="small" type="inner">
          <Paragraph>
            You can search this knowledge base using the following API endpoint:
          </Paragraph>
          <Paragraph copyable={{ text: curlCommand }}>
            <pre style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '12px', 
              borderRadius: '4px', 
              overflowX: 'auto',
              fontSize: '12px',
              border: '1px solid #d9d9d9'
            }}>
              {curlCommand}
            </pre>
          </Paragraph>
        </Card>

        <Card title={<span><SearchOutlined /> Test Search</span>} size="small" type="inner">
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Input 
              placeholder="Enter your query to test the knowledge base..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading}>
              Search
            </Button>
          </Space.Compact>

          {loading ? (
             <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>
          ) : (
            searchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {searchResults.map((item) => (
                  <div key={item.id} style={{ padding: '12px', border: '1px solid #f0f0f0', borderRadius: '8px' }}>
                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Tag color="blue">Score: {item.score.toFixed(4)}</Tag>
                        <Text strong>{item.document_id}</Text>
                    </div>
                    <Paragraph 
                      ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}
                      style={{ margin: 0 }}
                    >
                      {item.content}
                    </Paragraph>
                  </div>
                ))}
              </div>
            )
          )}
          {!loading && searchResults.length === 0 && query && (
             <div style={{ textAlign: 'center', color: '#999', padding: '10px' }}>No results found or search not started.</div>
          )}
        </Card>

      </Space>
    </Modal>
  );
};

export default KnowledgeBaseUsageModal;
