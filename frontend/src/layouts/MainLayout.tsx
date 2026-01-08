import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DesktopOutlined,
  FileOutlined,
  PieChartOutlined,
  TeamOutlined,
  UserOutlined,
  RobotOutlined,
  NodeIndexOutlined,
  SettingOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const { Header, Content, Footer, Sider } = Layout;

type MenuItem = Required<React.ComponentProps<typeof Menu>>['items'][number];

function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[],
): MenuItem {
  return {
    key,
    icon,
    children,
    label,
  } as MenuItem;
}

const items: MenuItem[] = [
  getItem('概览', '/', <PieChartOutlined />),
  getItem('智能体管理', '/agents', <RobotOutlined />),
  getItem('工作流编排', '/workflow', <NodeIndexOutlined />),
  getItem('知识库', '/knowledge', <BookOutlined />),
  getItem('系统设置', '/settings', <SettingOutlined />),
];

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();

  // Find the selected key based on current path
  const selectedKey = items.find(item => 
    location.pathname.startsWith(item?.key as string) && (item?.key as string) !== '/'
  )?.key || (location.pathname === '/' ? '/' : '');


  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap' }}>
           {collapsed ? 'AF' : 'AgentFlow Studio'}
        </div>
        <Menu 
          theme="dark" 
          defaultSelectedKeys={['/']} 
          selectedKeys={[selectedKey as string]}
          mode="inline" 
          items={items} 
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        {/* <Header style={{ padding: 0, background: colorBgContainer }} /> */}
        <Content style={{ margin: '0 16px' }}>
          {/* Breadcrumb could go here */}
          <div style={{ padding: 24, minHeight: 360, background: colorBgContainer, borderRadius: borderRadiusLG, marginTop: 16 }}>
            <Outlet />
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          AgentFlow Studio ©{new Date().getFullYear()} Created by Trae AI
        </Footer>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
