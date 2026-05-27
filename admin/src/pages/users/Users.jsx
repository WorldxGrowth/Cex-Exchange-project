import { useEffect, useState } from 'react';
import { Table, Tag, Button, Input, Space, Typography, Modal, Select, message, Card } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchUsers = async (pg = 1, q = '') => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers({ page: pg, limit: 20, search: q });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleStatus = async (id, status) => {
    try {
      await adminAPI.updateUserStatus(id, { status });
      message.success(`User ${status}`);
      fetchUsers(page, search);
    } catch (e) {
      message.error('Failed');
    }
  };

  const columns = [
    { title: 'UID',    dataIndex: 'uid',   key: 'uid', render: v => <code style={{ color: '#1890ff' }}>{v}</code> },
    { title: 'Email',  dataIndex: 'email', key: 'email', render: v => v || '-' },
    { title: 'KYC',    dataIndex: 'kyc_level', key: 'kyc', render: v => <Tag color={v > 0 ? 'green' : 'orange'}>Level {v}</Tag> },
    { title: 'VIP',    dataIndex: 'vip_level', key: 'vip', render: v => <Tag color="blue">VIP {v}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status',
      render: v => <Tag color={v === 'active' ? 'green' : v === 'suspended' ? 'orange' : 'red'}>{v}</Tag> },
    { title: 'Joined', dataIndex: 'created_at', key: 'created',
      render: v => new Date(v).toLocaleDateString() },
    {
      title: 'Actions', key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'active' ? (
            <Button size="small" danger onClick={() => handleStatus(record.id, 'suspended')}>Suspend</Button>
          ) : (
            <Button size="small" type="primary" onClick={() => handleStatus(record.id, 'active')}>Activate</Button>
          )}
          <Button size="small" danger onClick={() => handleStatus(record.id, 'banned')}>Ban</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          <UserOutlined /> Users Management
        </Typography.Title>
        <Input.Search
          placeholder="Search email, UID..."
          style={{ width: 280 }}
          onSearch={(v) => { setSearch(v); fetchUsers(1, v); }}
          allowClear
        />
      </div>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            total, pageSize: 20, current: page,
            onChange: (p) => { setPage(p); fetchUsers(p, search); },
            showTotal: (t) => `Total ${t} users`
          }}
          style={{ color: '#fff' }}
        />
      </Card>
    </div>
  );
}
