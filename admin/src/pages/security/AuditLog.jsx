import { useEffect, useState } from 'react';
import { Table, Tag, Select, Input, DatePicker, Button, Space, Card, Typography } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const ACTION_COLORS = {
  user_status_change: 'red',
  user_vip_change: 'purple',
  balance_adjust: 'orange',
  kyc_review: 'blue',
  withdrawal_process: 'cyan',
  coin_add: 'green',
  coin_update: 'geekblue',
  pair_add: 'green',
  pair_update: 'geekblue',
  orderbook_create: 'green',
  orderbook_update: 'orange',
  orderbook_delete: 'red',
  fee_rule_add: 'green',
  fee_rule_update: 'orange',
  fee_rule_delete: 'red',
  vip_level_update: 'purple',
  setting_update: 'orange',
  setting_add: 'green',
  admin_2fa_enable: 'green',
  admin_2fa_disable: 'red',
  admin_otp_toggle: 'orange',
  admin_pin_change: 'red',
};

export default function AuditLog() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [filters, setFilters] = useState({
    action: '', resource: '', admin_email: '', date_from: '', date_to: ''
  });

  const fetchLogs = async (pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pg, limit: 20,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });
      const res = await adminAPI.getAuditLogs(params.toString());
      setLogs(res.data?.logs || []);
      setTotal(res.data?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(1); }, []);

  const columns = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      width: 160,
      render: v => dayjs(v).format('DD-MM-YY HH:mm:ss'),
    },
    {
      title: 'Admin',
      dataIndex: 'admin_email',
      width: 180,
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#848e9c' }}>{r.admin_role}</div>
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 180,
      render: v => (
        <Tag color={ACTION_COLORS[v] || 'default'} style={{ fontSize: 11 }}>
          {v?.replace(/_/g, ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Resource',
      dataIndex: 'resource',
      width: 120,
      render: (v, r) => (
        <div>
          <div style={{ fontSize: 13 }}>{v}</div>
          {r.resource_id && (
            <div style={{ fontSize: 11, color: '#848e9c' }}>ID: {r.resource_id}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Changes',
      dataIndex: 'new_value',
      render: v => v ? (
        <code style={{
          fontSize: 11, background: '#1e2026',
          padding: '2px 6px', borderRadius: 4,
          color: '#f0b90b', display: 'block',
          maxWidth: 280, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {typeof v === 'object' ? JSON.stringify(v) : v}
        </code>
      ) : '—',
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      width: 130,
      render: v => <span style={{ fontSize: 11, color: '#848e9c' }}>{v || '—'}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 90,
      render: v => (
        <Tag color={v === 'success' ? 'green' : 'red'}>
          {v?.toUpperCase()}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={4} style={{ color: '#fff', marginBottom: 20 }}>
        🔍 Admin Audit Log
      </Title>

      {/* Filters */}
      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36', marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Action (e.g. coin_update)"
            value={filters.action}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
          />
          <Input
            placeholder="Resource (e.g. coins)"
            value={filters.resource}
            onChange={e => setFilters(f => ({ ...f, resource: e.target.value }))}
            style={{ width: 160 }}
          />
          <Input
            placeholder="Admin email"
            value={filters.admin_email}
            onChange={e => setFilters(f => ({ ...f, admin_email: e.target.value }))}
            style={{ width: 200 }}
          />
          <RangePicker
            onChange={(_, s) => setFilters(f => ({
              ...f, date_from: s[0] || '', date_to: s[1] || ''
            }))}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => { setPage(1); fetchLogs(1); }}
          >
            Search
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setFilters({ action: '', resource: '', admin_email: '', date_from: '', date_to: '' });
              setPage(1);
              fetchLogs(1);
            }}
          >
            Reset
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
        <Table
          columns={columns}
          dataSource={logs}
          loading={loading}
          rowKey="id"
          size="small"
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: (p) => { setPage(p); fetchLogs(p); },
            showTotal: (t) => `Total ${t} logs`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}
