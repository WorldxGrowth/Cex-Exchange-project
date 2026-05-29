import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Table, Tag, Spin } from 'antd';
import {
  UserOutlined, ArrowUpOutlined, ArrowDownOutlined,
  DollarOutlined, WalletOutlined, RocketOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { adminAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const COLORS = ['#f0b90b', '#0ecb81', '#f6465d', '#1890ff', '#722ed1'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentDeposits, setRecentDeposits] = useState([]);
  const [recentWithdrawals, setRecentWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminAPI.dashboard(),
      adminAPI.getDeposits({ limit: 5 }),
      adminAPI.getWithdrawals({ limit: 5 }),
    ]).then(([dash, deps, wds]) => {
      setStats(dash.data);
      setRecentDeposits(deps.data?.deposits || []);
      setRecentWithdrawals(wds.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 100 }}>
      <Spin size="large" />
    </div>
  );

  const statCards = [
    { title: 'Total Users', value: stats?.users?.total,
      sub: `+${stats?.users?.today || 0} today`,
      icon: <UserOutlined />, color: '#1890ff',
      path: '/users' },
    { title: '24h Volume', value: `$${parseFloat(stats?.trades_24h?.volume || 0).toFixed(2)}`,
      sub: `${stats?.trades_24h?.count || 0} trades`,
      icon: <DollarOutlined />, color: '#f0b90b',
      path: null },
    { title: 'Pending Withdraw', value: stats?.withdrawals?.pending,
      sub: `${stats?.withdrawals?.total} total`,
      icon: <ArrowUpOutlined />, color: '#f6465d',
      path: '/withdrawals' },
    { title: 'Pending KYC', value: stats?.listings?.pending || 0,
      sub: 'Awaiting review',
      icon: <WalletOutlined />, color: '#722ed1',
      path: '/kyc' },
    { title: 'Total Deposits', value: stats?.deposits?.total,
      sub: `${stats?.deposits?.pending || 0} pending`,
      icon: <ArrowDownOutlined />, color: '#0ecb81',
      path: '/deposits' },
    { title: 'Token Listings', value: stats?.listings?.total,
      sub: `${stats?.listings?.pending} pending`,
      icon: <RocketOutlined />, color: '#13c2c2',
      path: '/listings' },
  ];

  const userGrowthData = stats?.charts?.user_growth || [];
  const volumeData = stats?.charts?.volume || [];
  const coinDist = stats?.charts?.coin_dist?.length > 0
    ? stats.charts.coin_dist
    : [{ name: 'USDT', value: 1 }];

  return (
    <div>
      <Title level={4} style={{ color: '#fff', marginBottom: 16 }}>
        📊 Dashboard Overview
      </Title>

      {/* Stat Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {statCards.map(card => (
          <Col xs={12} sm={8} lg={4} key={card.title}>
            <Card
              style={{ background: '#1e2026', border: '1px solid #2b2f36', cursor: card.path ? 'pointer' : 'default' }}
              styles={{ body: { padding: '12px' } }}
              onClick={() => card.path && navigate(card.path)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#848e9c', fontSize: 11, display: 'block' }}>
                    {card.title}
                  </Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#fff',
                                margin: '4px 0', overflow: 'hidden',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {card.value ?? '-'}
                  </div>
                  <Text style={{ color: '#0ecb81', fontSize: 11 }}>{card.sub}</Text>
                </div>
                <div style={{ fontSize: 18, color: card.color, flexShrink: 0 }}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {/* User Growth */}
        <Col xs={24} lg={12}>
          <Card
            title={<Text style={{ color: '#fff', fontSize: 13 }}>👥 User Growth (7D)</Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}
            styles={{ body: { padding: '12px 8px' } }}
          >
            {userGrowthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={userGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b2f36" />
                  <XAxis dataKey="date" stroke="#848e9c" fontSize={10} />
                  <YAxis stroke="#848e9c" fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#2b2f36', border: 'none',
                                           fontSize: 11 }} />
                  <Line type="monotone" dataKey="users" stroke="#f0b90b"
                        strokeWidth={2} dot={{ fill: '#f0b90b', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: '#848e9c' }}>
                No data yet
              </div>
            )}
          </Card>
        </Col>

        {/* Volume Chart */}
        <Col xs={24} lg={12}>
          <Card
            title={<Text style={{ color: '#fff', fontSize: 13 }}>💰 Deposit vs Withdraw (7D)</Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}
            styles={{ body: { padding: '12px 8px' } }}
          >
            {volumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b2f36" />
                  <XAxis dataKey="date" stroke="#848e9c" fontSize={10} />
                  <YAxis stroke="#848e9c" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#2b2f36', border: 'none', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="deposit" fill="#0ecb81" name="Deposit" radius={[3,3,0,0]} />
                  <Bar dataKey="withdraw" fill="#f6465d" name="Withdraw" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: '#848e9c' }}>
                No data yet
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {/* Coin Distribution */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title={<Text style={{ color: '#fff', fontSize: 13 }}>🪙 Coin Distribution</Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}
            styles={{ body: { padding: '12px 8px' } }}
          >
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={coinDist} cx="50%" cy="50%" outerRadius={65}
                     dataKey="value"
                     label={({ name, percent }) =>
                       percent > 0.05 ? `${name} ${(percent*100).toFixed(0)}%` : ''}
                     labelLine={false} fontSize={10}>
                  {coinDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#2b2f36', border: 'none', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Scanner Status */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title={<Text style={{ color: '#fff', fontSize: 13 }}>🔍 Scanner Status</Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36', height: '100%' }}
            styles={{ body: { padding: '12px' } }}
          >
            {['BSC', 'ETH', 'VDCHAIN'].map((net, i) => (
              <div key={net} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '10px 0',
                borderBottom: i < 2 ? '1px solid #2b2f36' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%',
                                background: '#0ecb81',
                                boxShadow: '0 0 6px #0ecb81' }} />
                  <Text style={{ color: '#fff', fontWeight: 600 }}>{net}</Text>
                </div>
                <Tag color="green" style={{ fontSize: 11 }}>
                  <CheckCircleOutlined /> Active
                </Tag>
              </div>
            ))}
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col xs={24} lg={8}>
          <Card
            title={<Text style={{ color: '#fff', fontSize: 13 }}>⚡ Quick Actions</Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36', height: '100%' }}
            styles={{ body: { padding: '12px' } }}
          >
            {[
              { label: `${stats?.withdrawals?.pending || 0} Pending Withdrawals`,
                color: '#f6465d', path: '/withdrawals' },
              { label: `Pending KYC Reviews`,
                color: '#f0b90b', path: '/kyc' },
              { label: `${stats?.listings?.pending || 0} Token Listings`,
                color: '#1890ff', path: '/listings' },
              { label: `View All Users`,
                color: '#0ecb81', path: '/users' },
            ].map(item => (
              <div key={item.label} onClick={() => navigate(item.path)}
                style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 8,
                         background: item.color + '15',
                         border: `1px solid ${item.color}30`,
                         cursor: 'pointer', display: 'flex',
                         alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%',
                              background: item.color, flexShrink: 0 }} />
                <Text style={{ color: item.color, fontWeight: 600, fontSize: 12 }}>
                  {item.label}
                </Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Recent Transactions */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card
            title={<Text style={{ color: '#fff', fontSize: 13 }}>📥 Recent Deposits</Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}
            styles={{ body: { padding: '0 8px' } }}
          >
            <Table
              dataSource={recentDeposits}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 400 }}
              columns={[
                { title: 'User', dataIndex: 'email', key: 'email', width: 120,
                  render: v => <Text style={{ color: '#fff', fontSize: 11 }}>
                    {v?.split('@')[0]}
                  </Text> },
                { title: 'Amount', key: 'amount', width: 100,
                  render: (_, r) => <Text style={{ color: '#0ecb81', fontSize: 11,
                                                   fontWeight: 600 }}>
                    +{parseFloat(r.amount).toFixed(2)} {r.symbol}
                  </Text> },
                { title: 'Status', dataIndex: 'status', key: 'status', width: 80,
                  render: v => <Tag color="green" style={{ fontSize: 10 }}>{v}</Tag> },
                { title: 'Time', dataIndex: 'created_at', key: 'time',
                  render: v => <Text style={{ color: '#848e9c', fontSize: 10 }}>
                    {new Date(v).toLocaleTimeString()}
                  </Text> },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<Text style={{ color: '#fff', fontSize: 13 }}>📤 Recent Withdrawals</Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}
            styles={{ body: { padding: '0 8px' } }}
          >
            <Table
              dataSource={recentWithdrawals}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 400 }}
              columns={[
                { title: 'User', dataIndex: 'email', key: 'email', width: 120,
                  render: v => <Text style={{ color: '#fff', fontSize: 11 }}>
                    {v?.split('@')[0]}
                  </Text> },
                { title: 'Amount', key: 'amount', width: 100,
                  render: (_, r) => <Text style={{ color: '#f6465d', fontSize: 11,
                                                   fontWeight: 600 }}>
                    -{parseFloat(r.amount).toFixed(2)} {r.symbol}
                  </Text> },
                { title: 'Status', dataIndex: 'status', key: 'status', width: 80,
                  render: v => <Tag color={
                    v==='completed'?'green':v==='pending'?'orange':'red'
                  } style={{ fontSize: 10 }}>{v}</Tag> },
                { title: 'Time', dataIndex: 'created_at', key: 'time',
                  render: v => <Text style={{ color: '#848e9c', fontSize: 10 }}>
                    {new Date(v).toLocaleTimeString()}
                  </Text> },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
