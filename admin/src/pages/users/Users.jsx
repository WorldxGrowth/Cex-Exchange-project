import { useEffect, useState } from 'react';
import { Table, Card, Input, Select, Button, Tag, Space,
         Typography, Row, Col, Modal, Form, InputNumber,
         Popconfirm, message, Drawer, Descriptions, Tabs } from 'antd';
import { SearchOutlined, UserOutlined, EditOutlined,
         StopOutlined, CheckOutlined, DollarOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const { Text, Title } = Typography;

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '', status: '' });
  const [balanceModal, setBalanceModal] = useState({ open: false, user: null });
  const [form] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers(filters);
      setUsers(res.data?.users || []);
      setTotal(res.data?.total || 0);
    } catch (e) {
      message.error('Failed to load users');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, [filters]);

  const handleStatus = async (id, status) => {
    try {
      await adminAPI.updateUserStatus(id, { status });
      message.success(`User ${status}`);
      loadUsers();
    } catch { message.error('Failed'); }
  };

  const handleBalanceAdjust = async (values) => {
    try {
      await adminAPI.adjustBalance(balanceModal.user.id, values);
      message.success('Balance adjusted');
      setBalanceModal({ open: false, user: null });
      form.resetFields();
    } catch (e) {
      message.error(e?.message || 'Failed');
    }
  };

  const columns = [
    { title: 'UID', dataIndex: 'uid', key: 'uid', width: 100,
      render: v => <Text copyable style={{ color: '#848e9c', fontSize: 11 }}>{v}</Text> },
    { title: 'Email', dataIndex: 'email', key: 'email',
      render: v => <Text style={{ color: '#fff' }}>{v}</Text> },
    { title: 'Phone', dataIndex: 'phone', key: 'phone',
      render: v => <Text style={{ color: '#848e9c' }}>{v || '-'}</Text> },
    { title: 'KYC', dataIndex: 'kyc_level', key: 'kyc',
      width: 80,
      render: v => <Tag color={v > 0 ? 'green' : 'orange'}>
        {v > 0 ? `Level ${v}` : 'Unverified'}
      </Tag> },
    { title: 'VIP', dataIndex: 'vip_level', key: 'vip', width: 60,
      render: v => <Tag color="gold">VIP {v}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={v === 'active' ? 'green' : v === 'suspended' ? 'orange' : 'red'}>
        {v}
      </Tag> },
    { title: 'Joined', dataIndex: 'created_at', key: 'joined', width: 100,
      render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>
        {new Date(v).toLocaleDateString()}
      </Text> },
    { title: 'Actions', key: 'actions', width: 160, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<UserOutlined />}
            onClick={() => navigate(`/users/${record.id}`)}>
            View
          </Button>
          <Button size="small" icon={<DollarOutlined />} type="dashed"
            onClick={() => setBalanceModal({ open: true, user: record })}>
            Balance
          </Button>
          {record.status === 'active' ? (
            <Popconfirm title="Ban this user?" onConfirm={() => handleStatus(record.id, 'banned')}>
              <Button size="small" danger icon={<StopOutlined />}>Ban</Button>
            </Popconfirm>
          ) : (
            <Popconfirm title="Activate this user?" onConfirm={() => handleStatus(record.id, 'active')}>
              <Button size="small" type="primary" icon={<CheckOutlined />}>Activate</Button>
            </Popconfirm>
          )}
        </Space>
      )
    },
  ];

  return (
    <div>
      <Title level={4} style={{ color: '#fff', marginBottom: 16 }}>👥 User Management</Title>

      {/* Filters */}
      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36', marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={10}>
            <Input.Search
              placeholder="Search email, UID, phone..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6}>
            <Select style={{ width: '100%' }} placeholder="Status"
              allowClear value={filters.status || undefined}
              onChange={v => setFilters({ ...filters, status: v || '', page: 1 })}>
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="suspended">Suspended</Select.Option>
              <Select.Option value="banned">Banned</Select.Option>
            </Select>
          </Col>
          <Col xs={12} sm={6}>
            <Select style={{ width: '100%' }} placeholder="KYC Level"
              allowClear onChange={v => setFilters({ ...filters, kyc_level: v, page: 1 })}>
              <Select.Option value={0}>Unverified</Select.Option>
              <Select.Option value={1}>Level 1</Select.Option>
              <Select.Option value={2}>Level 2</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={2}>
            <Button type="primary" onClick={loadUsers}>Refresh</Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            total, pageSize: filters.limit, current: filters.page,
            onChange: page => setFilters({ ...filters, page }),
            showTotal: t => <Text style={{ color: '#848e9c' }}>Total {t} users</Text>
          }}
        />
      </Card>

      {/* Balance Adjust Modal */}
      <Modal
        title={<Text style={{ color: '#fff' }}>💰 Adjust Balance - {balanceModal.user?.email}</Text>}
        open={balanceModal.open}
        onCancel={() => setBalanceModal({ open: false, user: null })}
        onOk={() => form.submit()}
        okText="Adjust"
      >
        <Form form={form} onFinish={handleBalanceAdjust} layout="vertical">
          <Form.Item name="coin" label="Coin" rules={[{ required: true }]}>
            <Select placeholder="Select coin">
              {['USDT','BTC','ETH','BNB','VDC'].map(c => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="Amount (+/-)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} placeholder="+10 or -10" />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Input placeholder="Admin adjustment reason" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
