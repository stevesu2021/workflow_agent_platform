import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Space, Typography, Upload, message, Card } from 'antd';
import { PlayCircleOutlined, UploadOutlined } from '@ant-design/icons';
import type { AiResource } from '../types/aiResource';
import { aiResourcesApi } from '../api/aiResources';

const { TextArea } = Input;
const { Text } = Typography;

interface ResourceTestModalProps {
  resource: AiResource | null;
  visible: boolean;
  onCancel: () => void;
}

const ResourceTestModal: React.FC<ResourceTestModalProps> = ({ resource, visible, onCancel }) => {
  const [inputContent, setInputContent] = useState<string>('');
  const [outputContent, setOutputContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [mineruFile, setMineruFile] = useState<File | null>(null);
  const [mineruConfig, setMineruConfig] = useState({
    backend: 'vlm-vllm-async-engine',
    parse_method: 'auto',
    formula_enable: 'true',
    table_enable: 'true',
    start_page_id: '0'
  });

  // Default Templates based on resource type
  const getTemplate = (type: string) => {
    // Mineru PDF Parsing Template
    if (type === 'mineru') {
      return JSON.stringify({
        backend: 'vlm-vllm-async-engine',
        parse_method: 'auto',
        formula_enable: 'true',
        table_enable: 'true',
        start_page_id: '0'
      }, null, 2);
    }

    // Vision / Image Model Template
    if (type === 'vision_llm' || type.includes('vision')) {
      return JSON.stringify({
        model: resource?.name || "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What is in this image?" },
              { type: "image_url", image_url: { url: "<IMAGE_BASE64_PLACEHOLDER>" } }
            ]
          }
        ],
        max_tokens: 300
      }, null, 2);
    }

    // Rerank Model Template
    if (type === 'rerank' || type.includes('rerank')) {
      return JSON.stringify({
        model: resource?.name || "qwen3-4b-reranker",
        query: "如何做西红柿炒鸡蛋？",
        documents: [
          "西红柿炒鸡蛋是一道经典的家常菜，主要原料是鸡蛋和番茄。",
          "红烧肉的做法：五花肉焯水后加酱油、糖炖煮至软烂。",
          "番茄富含维生素C，鸡蛋提供优质蛋白，两者搭配营养均衡。",
          "宫保鸡丁需要花生、干辣椒和鸡胸肉炒制。"
        ]
      }, null, 2);
    }

    // Embedding Model Template
    if (type === 'embedding' || type.includes('embedding')) {
      return JSON.stringify({
        input: [
          "通义千问是阿里巴巴推出的开源大模型。",
          "Qwen3 supports strong reasoning and coding capabilities."
        ],
        model: resource?.name || "Qwen3-Embedding-0.6B"
      }, null, 2);
    }

    // Default Text LLM Template
    return JSON.stringify({
      model: resource?.name || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, this is a test message." }
      ],
      temperature: 0.7
    }, null, 2);
  };

  useEffect(() => {
    if (visible && resource) {
      setInputContent(getTemplate(resource.type));
      setOutputContent('');
    }
  }, [visible, resource]);

  const handleRunTest = async () => {
    if (!resource) return;
    setLoading(true);
    try {
      // Special handling for mineru type - needs file upload
      if (resource.type === 'mineru') {
        if (!mineruFile) {
          message.error('Please select a PDF file to test Mineru parsing');
          setLoading(false);
          return;
        }

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', mineruFile);

        // Parse config from inputContent or use default config
        let config;
        try {
          config = JSON.parse(inputContent);
        } catch (e) {
          config = mineruConfig; // Use default config
        }

        formData.append('backend', config.backend || 'vlm-vllm-async-engine');
        formData.append('parse_method', config.parse_method || 'auto');
        formData.append('formula_enable', config.formula_enable || 'true');
        formData.append('table_enable', config.table_enable || 'true');
        formData.append('start_page_id', config.start_page_id || '0');

        // Call the backend proxy endpoint
        const response = await fetch(`/api/ai-resources/${resource.id}/mineru-parse`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }));
          throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        setOutputContent(JSON.stringify(result, null, 2));
        message.success('Mineru test executed successfully');
      } else {
        // Standard JSON payload for other types
        let payload;
        try {
          payload = JSON.parse(inputContent);
        } catch (e) {
          message.error('Invalid JSON input');
          setLoading(false);
          return;
        }

        const result = await aiResourcesApi.testResource(resource.id, payload);
        setOutputContent(JSON.stringify(result, null, 2));
        message.success('Test executed successfully');
      }
    } catch (error: any) {
      setOutputContent(JSON.stringify({ error: error.message || 'Unknown error' }, null, 2));
      message.error('Test execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      
      // Check if placeholder exists in current content
      if (inputContent.includes('<IMAGE_BASE64_PLACEHOLDER>')) {
        setInputContent(inputContent.replace('<IMAGE_BASE64_PLACEHOLDER>', base64));
        message.success('Image inserted into template successfully');
      } else {
        // If no placeholder, we copy to clipboard and notify user
        navigator.clipboard.writeText(base64)
          .then(() => message.success('Base64 copied to clipboard! Paste it into your JSON.'))
          .catch(() => message.warning('Could not copy to clipboard.'));
      }
    };
    reader.readAsDataURL(file);
    return false; // Prevent automatic upload
  };

  if (!resource) return null;

  return (
    <Modal
      title={
        <Space>
          <PlayCircleOutlined />
          <span>Test Resource: {resource.name}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="close" onClick={onCancel}>Close</Button>,
        <Button 
          key="run" 
          type="primary" 
          icon={<PlayCircleOutlined />} 
          loading={loading}
          onClick={handleRunTest}
        >
          Run Test
        </Button>
      ]}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>

        <Card size="small" title="Request Details" type="inner">
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>Request URL: </Text>
              <Text code copyable>{resource.endpoint}</Text>
            </div>
            {resource.type !== 'mineru' && (
              <div>
                <Text strong>Request Headers: </Text>
                <Text code>Authorization: Bearer {'*'.repeat(8)}</Text>
              </div>
            )}
            {resource.type === 'mineru' && (
              <div>
                <Text type="secondary">Mineru uses multipart/form-data for file upload</Text>
              </div>
            )}
          </Space>
        </Card>

        {/* Mineru File Upload Section */}
        {resource.type === 'mineru' && (
          <Card size="small" title="PDF File Upload" type="inner">
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Upload
                accept=".pdf"
                fileList={mineruFile ? [{ uid: '1', name: mineruFile.name, status: 'done' }] : []}
                onRemove={() => setMineruFile(null)}
                beforeUpload={(file) => {
                  setMineruFile(file);
                  return false;
                }}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Select PDF File</Button>
              </Upload>
              {mineruFile && (
                <Text type="secondary">Selected: {mineruFile.name} ({(mineruFile.size / 1024 / 1024).toFixed(2)} MB)</Text>
              )}
            </Space>
          </Card>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>{resource.type === 'mineru' ? 'Config (JSON):' : 'Input Demo (JSON Body):'}</Text>
            {resource.type !== 'mineru' && (
              <Space>
                <Button size="small" onClick={() => setInputContent(getTemplate(resource.type))}>Reset Template</Button>
                <Upload
                  beforeUpload={handleFileRead}
                  showUploadList={false}
                  accept="image/*,.pdf"
                >
                  <Button icon={<UploadOutlined />} size="small" type="primary" ghost>Insert Image/File</Button>
                </Upload>
              </Space>
            )}
            {resource.type === 'mineru' && (
              <Button size="small" onClick={() => setInputContent(getTemplate(resource.type))}>Reset Template</Button>
            )}
          </div>
          <TextArea
            rows={resource.type === 'mineru' ? 6 : 12}
            value={inputContent}
            onChange={e => setInputContent(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
            spellCheck={false}
          />
        </div>

        <div>
          <Text strong>Output Demo:</Text>
          <TextArea
            rows={10}
            value={outputContent}
            readOnly
            style={{ fontFamily: 'monospace', backgroundColor: '#fafafa', fontSize: '12px' }}
            placeholder="Response will appear here..."
          />
        </div>

      </Space>
    </Modal>
  );
};

export default ResourceTestModal;
