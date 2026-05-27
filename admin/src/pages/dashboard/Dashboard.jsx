import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Table, Tag, Spin } from 'antd';
import {
  UserOutlined, SwapOutlined, DollarOutlined,
  WalletOutlined, RocketOutlined, ArrowUpOutlined
} from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.dashboard().then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

  const cards = [
    { title: 'Total Users',       value: stats?.users?.total,            icon: <UserOutlined />,    color: '#1890ff', sub: `+${stats?.users?.today} today` },
    { title: 'Open Orders',       value: stats?.orders?.open,            icon: <SwapOutlined />,    color: '#52c41a', sub: `${stats?.orders?.total} total` },
    { title: '24h Volume',        value: `$${parseFloat(stats?.trades_24h?.volume || 0).toFixed(2)}`, icon: <DollarOutlined />, color: '#faad14', sub: `${stats?.trades_24h?.count} trades` },
    { title: 'Pending Withdraw',  value: stats?.withdrawals?.pending,    icon: <WalletOutlined />,  color: '#ff4d4f', sub: `${stats?.withdrawals?.total} total` },
    { title: 'Pending Deposits',  value: stats?.deposits?.pending,       icon: <ArrowUpOutlined />, color: '#722ed1', sub: `${stats?.deposits?.total} total` },
    { title: 'Pending Listings',  value: stats?.listings?.pending,       icon: <RocketOutlined />,  color: '#13c2c2', sub: `${stats?.listings?.total} total` },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: '#fff', marginBottom: 24 }}>
        📊 Dashboard Overview
      </Typography.Title>

      <Row gutter={[16, 16]}>
        {cards.map((card, i) => (
          <Col xs={24} sm={12} lg={8} key={i}>
            <Card
              style={{
                background: '#1f1f1f',
                border: '1px solid #303030',
                borderRadius: 12
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Typography.Text style={{ color: '#888', fontSize: 13 }}>
                    {card.title}
                  </Typography.Text>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: '4px 0' }}>
                    {card.value ?? 0}
                  </div>
                  <Typography.Text style={{ color: '#888', fontSize: 12 }}>
                    {card.sub}
                  </Typography.Text>
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: card.color + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, color: card.color
                }}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
