import React from 'react';
import { Card, Typography, Statistic, Row, Col } from 'antd';
import { RobotOutlined, NodeIndexOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const Home: React.FC = () => {
  return (
    <div>
      <Title level={2}>Welcome to AgentFlow Studio</Title>
      <Paragraph>
        Build, deploy, and manage your AI agent workflows with ease.
      </Paragraph>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={8}>
          <Card variant="borderless">
            <Statistic
              title="Active Agents"
              value={12}
              prefix={<RobotOutlined />}
              styles={{ content: { color: '#3f8600' } }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless">
            <Statistic
              title="Total Workflows"
              value={5}
              prefix={<NodeIndexOutlined />}
              styles={{ content: { color: '#cf1322' } }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless">
            <Statistic
              title="Tasks Completed"
              value={93}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#1677ff' } }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Home;
