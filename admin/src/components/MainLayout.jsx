import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Drawer, Button } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, UserOutlined, SettingOutlined, RobotOutlined,
  LogoutOutlined, DollarOutlined, SafetyOutlined,
  RadarChartOutlined, PictureOutlined, ArrowDownOutlined,
  ArrowUpOutlined, RocketOutlined, MenuOutlined, CloseOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const menuItems = [
    { key: '/dashboard',   icon: <DashboardOutlined />,  label: 'Dashboard' },
    { key: '/users',       icon: <UserOutlined />,       label: 'Users' },
    { key: '/kyc',         icon: <SafetyOutlined />,     label: 'KYC Management' },
    { key: '/deposits',    icon: <ArrowDownOutlined />,  label: 'Deposits' },
    { key: '/withdrawals', icon: <ArrowUpOutlined />,    label: 'Withdrawals' },
    { key: '/coins',       icon: <DollarOutlined />,     label: 'Coins & Pairs' },
    { key: '/listings',    icon: <RocketOutlined />,     label: 'Token Listings' },
    { key: '/scanner',     icon: <RadarChartOutlined />, label: 'Scanner' },
    { key: '/banners',     icon: <PictureOutlined />,    label: 'Banners' },
    { key: '/bots',        icon: <RobotOutlined />,      label: 'Market Bots' },
    { key: '/settings',    icon: <SettingOutlined />,    label: 'Settings' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/login');
  };

  const userMenu = {
    items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true }],
    onClick: ({ key }) => { if (key === 'logout') handleLogout(); }
  };

  const currentPage = menuItems.find(m => m.key === location.pathname)?.label || 'Admin Panel';

  const SidebarMenu = () => (
    <div style={{ height: '100%', background: '#1e2026', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        height: 64, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 16px',
        borderBottom: '1px solid #2b2f36', flexShrink: 0
      }}>
        <Typography.Text strong style={{ color: '#f0b90b', fontSize: 18 }}>
          ⚡ VDExchange
        </Typography.Text>
        {isMobile && (
          <Button type="text" icon={<CloseOutlined />}
            onClick={() => setMobileOpen(false)}
            style={{ color: '#848e9c' }} />
        )}
      </div>
      <Menu
        theme="dark"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ background: '#1e2026', borderRight: 'none',
                 marginTop: 8, flex: 1, overflow: 'auto' }}
      />
      <div style={{ padding: '16px', borderTop: '1px solid #2b2f36' }}>
        <div onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
          color: '#f6465d', transition: '0.2s'
        }}>
          <LogoutOutlined />
          <Typography.Text style={{ color: '#f6465d' }}>Logout</Typography.Text>
        </div>
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh', background: '#0b0e11' }}>

      {!isMobile && (
        <Sider
          collapsible collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{ background: '#1e2026', borderRight: '1px solid #2b2f36' }}
          width={220}
        >
          <div style={{
            height: 64, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderBottom: '1px solid #2b2f36'
          }}>
            {!collapsed
              ? <Typography.Text strong style={{ color: '#f0b90b', fontSize: 18 }}>
                  ⚡ VDExchange
                </Typography.Text>
              : <Typography.Text style={{ color: '#f0b90b', fontSize: 20 }}>⚡</Typography.Text>
            }
          </div>
          <Menu
            theme="dark"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: '#1e2026', borderRight: 'none', marginTop: 8 }}
          />
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          width={240}
          styles={{ body: { padding: 0, background: '#1e2026' },
                    header: { display: 'none' } }}
        >
          <SidebarMenu />
        </Drawer>
      )}

      <Layout>
        <Header style={{
          background: '#1e2026', padding: '0 16px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #2b2f36',
          height: 56, lineHeight: '56px',
          position: 'sticky', top: 0, zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined style={{ fontSize: 18, color: '#f0b90b' }} />}
                onClick={() => setMobileOpen(true)}
                style={{ padding: 4 }}
              />
            )}
            <Typography.Text style={{
              color: '#fff', fontSize: isMobile ? 14 : 16, fontWeight: 600
            }}>
              {isMobile ? currentPage : 'Admin Panel'}
            </Typography.Text>
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ background: '#f0b90b', color: '#000', fontSize: 14 }}>A</Avatar>
              {!isMobile && (
                <Typography.Text style={{ color: '#fff' }}>Admin</Typography.Text>
              )}
            </Space>
          </Dropdown>
        </Header>

        <Content style={{
          margin: isMobile ? '8px' : '16px',
          padding: isMobile ? '12px' : '16px',
          background: '#0b0e11',
          minHeight: 'calc(100vh - 56px)',
          overflowY: 'auto'
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
