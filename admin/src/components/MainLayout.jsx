import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, UserOutlined, WalletOutlined,
  SwapOutlined, RocketOutlined, SettingOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  DollarOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/dashboard',   icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/users',       icon: <UserOutlined />,      label: 'Users' },
    { key: '/coins',       icon: <DollarOutlined />,    label: 'Coins & Pairs' },
    { key: '/withdrawals', icon: <WalletOutlined />,    label: 'Withdrawals' },
    { key: '/listings',    icon: <RocketOutlined />,    label: 'Token Listings' },
    { key: '/settings',    icon: <SettingOutlined />,   label: 'Settings' },
  ];

  const userMenu = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: () => {
        localStorage.removeItem('admin_token');
        navigate('/login');
      }
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        style={{ background: '#001529' }}
        width={220}
      >
        <div className="logo-text">
          {collapsed ? 'VDE' : '⚡ VDExchange'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: '#001529', borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: '#141414',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #303030'
        }}>
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{ cursor: 'pointer', color: '#fff', fontSize: 18 }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          <Dropdown menu={{ items: userMenu }}>
            <Space style={{ cursor: 'pointer', color: '#fff' }}>
              <Avatar icon={<UserOutlined />} style={{ background: '#1890ff' }} />
              <Typography.Text style={{ color: '#fff' }}>Admin</Typography.Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{
          margin: '24px',
          padding: '24px',
          background: '#141414',
          borderRadius: 12,
          minHeight: 'calc(100vh - 112px)'
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
