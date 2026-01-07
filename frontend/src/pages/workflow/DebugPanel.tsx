import React, { useState } from 'react';
import type { Node } from 'reactflow';
import { Input, Button, Upload, message as antdMessage, Typography, Card } from 'antd';
import { UploadOutlined, SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useParams } from 'react-router-dom';

interface DebugPanelProps {
  nodes: Node[];
}

interface Message {
  role: 'user' | 'agent';
  content: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ nodes }) => {
  const { id } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  // Derive used resources from nodes
  // We use the label in data, or fall back to type
  const usedResources = Array.from(new Set(nodes.map(n => n.data.label || n.type)));

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg: Message = { role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      // Assuming the agent ID is available in the URL
      // If id is undefined (new workflow), we can't run it yet
      if (!id) {
        antdMessage.warning('Please save the workflow first before debugging.');
        setLoading(false);
        return;
      }

      const response = await axios.post(`/api/agents/${id}/run`, {
        inputs: { input: userMsg.content }
      });
      
      let outputContent = '';
      if (typeof response.data.output === 'string') {
          outputContent = response.data.output;
      } else if (response.data.output && response.data.output.content) {
          outputContent = response.data.output.content;
      } else {
          outputContent = JSON.stringify(response.data.output);
      }

      const agentMsg: Message = { role: 'agent', content: outputContent };
      setMessages(prev => [...prev, agentMsg]);
    } catch (error) {
      console.error(error);
      antdMessage.error('Failed to run agent');
      setMessages(prev => [...prev, { role: 'agent', content: 'Error executing agent.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: Resources */}
      <div style={{ width: '250px', borderRight: '1px solid #eee', padding: '16px', overflowY: 'auto', backgroundColor: '#fafafa' }}>
        <Typography.Title level={5} style={{ marginBottom: '16px' }}>调试资源列表</Typography.Title>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>当前编排用到的组件</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {usedResources.map((item, index) => (
                <Card key={index} size="small" bodyStyle={{ padding: '8px 12px' }}>
                    <Typography.Text>{item}</Typography.Text>
                </Card>
            ))}
        </div>
      </div>

      {/* Right: Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' }}>
        <Typography.Title level={5} style={{ marginBottom: '16px' }}>对话测试</Typography.Title>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#ccc', marginTop: '20px' }}>
              暂无对话，请在下方输入内容开始调试
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ 
                  maxWidth: '70%', 
                  padding: '8px 12px', 
                  borderRadius: '8px', 
                  backgroundColor: msg.role === 'user' ? '#1890ff' : '#f5f5f5',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                     {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />} 
                     {msg.role === 'user' ? 'User' : 'Agent'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
            <Upload beforeUpload={() => false} maxCount={1}>
                <Button icon={<UploadOutlined />}>上传文件</Button>
            </Upload>
            <Input.TextArea 
                value={inputValue} 
                onChange={e => setInputValue(e.target.value)} 
                placeholder="请输入测试内容..." 
                autoSize={{ minRows: 1, maxRows: 4 }}
                onPressEnter={(e) => {
                    if (!e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={loading}>
                发送
            </Button>
        </div>
      </div>
    </div>
  );
};
