import React from 'react';
import { Card, Typography, Empty } from 'antd';

const { Title, Paragraph } = Typography;

const Agentic: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Agentic 智能体</Title>
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              该功能正在开发中，敬请期待...
            </span>
          }
        />
      </Card>
    </div>
  );
};

export default Agentic;
