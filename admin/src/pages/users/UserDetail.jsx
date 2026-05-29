import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Table, Tabs,
         Typography, Row, Col, Space, message, Statistic } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

const { Text, Title } = Typography;

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [balances, setBalances] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminAPI.getUserDetail(id),
      adminAPI.getUserBalances(id),
      adminAPI.getUserDeposits(id),
      adminAPI.getUserWithdrawals(id),
      adminAPI.getUserLedger(id),
    ]).then(([u, b, d, w, l]) => {
      setUser(u.data);
      setBalances(b.data || []);
      setDeposits(d.data || []);
      setWithdrawals(w.data || []);
      setLedger(l.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading || !user) return (
    <div style={{ color: '#fff', padding: 40, textAlign: 'center' }}>Loading...</div>
  );

  const tabItems = [
    {
      key: 'balances', label: 'Balances',
      children: (
        <Table dataSource={balances} rowKey={r => r.symbol + r.account_type}
          pagination={false} size="small"
          columns={[
            { title: 'Coin', dataIndex: 'symbol', render: v => <Tag>{v}</Tag> },
            { title: 'Account', dataIndex: 'account_type', render: v => <Tag color="blue">{v}</Tag> },
            { title: 'Available', dataIndex: 'available',
              render: v => <Text style={{ color: '#0ecb81' }}>{parseFloat(v||0).toFixed(6)}</Text> },
            { title: 'Locked', dataIndex: 'locked',
              render: v => <Text style={{ color: '#f6465d' }}>{parseFloat(v||0).toFixed(6)}</Text> },
          ]} />
      )
    },
    {
      key: 'deposits', label: `Deposits (${deposits.length})`,
      children: (
        <Table dataSource={deposits} rowKey="id" pagination={{ pageSize: 10 }} size="small"
          columns={[
            { title: 'Coin', dataIndex: 'symbol', render: v => <Tag>{v}</Tag> },
            { title: 'Amount', dataIndex: 'amount',
              render: (v, r) => <Text style={{ color: '#0ecb81' }}>
                +{parseFloat(v).toFixed(6)} {r.symbol}
              </Text> },
            { title: 'Network', dataIndex: 'network', render: v => <Tag>{v}</Tag> },
            { title: 'Status', dataIndex: 'status',
              render: v => <Tag color="green">{v}</Tag> },
            { title: 'Time', dataIndex: 'created_at',
              render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>
                {new Date(v).toLocaleString()}
              </Text> },
          ]} />
      )
    },
    {
      key: 'withdrawals', label: `Withdrawals (${withdrawals.length})`,
      children: (
        <Table dataSource={withdrawals} rowKey="id" pagination={{ pageSize: 10 }} size="small"
          columns={[
            { title: 'Coin', dataIndex: 'symbol', render: v => <Tag>{v}</Tag> },
            { title: 'Amount', dataIndex: 'amount',
              render: (v, r) => <Text style={{ color: '#f6465d' }}>
                -{parseFloat(v).toFixed(6)} {r.symbol}
              </Text> },
            { title: 'To', dataIndex: 'to_address',
              render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>
                {v?.slice(0,10)}...
              </Text> },
            { title: 'Status', dataIndex: 'status',
              render: v => <Tag color={v==='completed'?'green':v==='pending'?'orange':'red'}>{v}</Tag> },
            { title: 'Time', dataIndex: 'created_at',
              render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>
                {new Date(v).toLocaleString()}
              </Text> },
          ]} />
      )
    },
    {
      key: 'ledger', label: `Ledger (${ledger.length})`,
      children: (
        <Table dataSource={ledger} rowKey="id" pagination={{ pageSize: 15 }} size="small"
          columns={[
            { title: 'Type', dataIndex: 'type',
              render: v => <Tag color={v==='deposit'?'green':v==='withdrawal'?'red':'blue'}>{v}</Tag> },
            { title: 'Amount', dataIndex: 'amount',
              render: (v, r) => <Text style={{
                color: r.type==='deposit' ? '#0ecb81' : '#f6465d', fontWeight: 600
              }}>
                {r.type==='deposit'?'+':'-'}{parseFloat(v).toFixed(6)} {r.symbol}
              </Text> },
            { title: 'Before', dataIndex: 'balance_before',
              render: v => <Text style={{ color: '#848e9c' }}>{parseFloat(v||0).toFixed(4)}</Text> },
            { title: 'After', dataIndex: 'balance_after',
              render: v => <Text style={{ color: '#fff' }}>{parseFloat(v||0).toFixed(4)}</Text> },
            { title: 'Description', dataIndex: 'description',
              render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>{v}</Text> },
            { title: 'Time', dataIndex: 'created_at',
              render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>
                {new Date(v).toLocaleString()}
              </Text> },
          ]} />
      )
    },
  ];

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}
        style={{ marginBottom: 16 }}>Back to Users</Button>

      {/* User Info Card */}
      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36', marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Title level={4} style={{ color: '#fff', marginBottom: 12 }}>
              👤 {user.email}
            </Title>
            <Descriptions size="small" column={2}
              labelStyle={{ color: '#848e9c' }} contentStyle={{ color: '#fff' }}>
              <Descriptions.Item label="UID">
                <Text copyable style={{ color: '#f0b90b' }}>{user.uid}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={user.status==='active'?'green':user.status==='banned'?'red':'orange'}>
                  {user.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Phone">{user.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="KYC">
                <Tag color={user.kyc_level > 0 ? 'green' : 'orange'}>
                  {user.kyc_level > 0 ? `Level ${user.kyc_level}` : 'Unverified'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="VIP">
                <Tag color="gold">VIP {user.vip_level}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Referral">{user.referral_code}</Descriptions.Item>
              <Descriptions.Item label="Joined">
                {new Date(user.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Last Login">
                {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col xs={24} md={8}>
            <Row gutter={[8, 8]}>
              <Col span={12}>
                <Statistic title={<Text style={{ color: '#848e9c' }}>Deposits</Text>}
                  value={deposits.length}
                  valueStyle={{ color: '#0ecb81' }} />
              </Col>
              <Col span={12}>
                <Statistic title={<Text style={{ color: '#848e9c' }}>Withdrawals</Text>}
                  value={withdrawals.length}
                  valueStyle={{ color: '#f6465d' }} />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* Tabs */}
      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}
