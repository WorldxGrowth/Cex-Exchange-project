import { useEffect, useState } from 'react';
import { Table, Card, Input, Select, Button, Tag, Space,
         Typography, Row, Col, DatePicker, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

const { Text } = Typography;
const { RangePicker } = DatePicker;

export default function Deposits() {
  const [deposits, setDeposits] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    page: 1, limit: 20, search: '', coin: '', status: '', network: ''
  });

  const loadDeposits = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getDeposits(filters);
      setDeposits(res.data?.deposits || res.data || []);
      setTotal(res.data?.total || 0);
    } catch { message.error('Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadDeposits(); }, [filters]);

  const columns = [
    { title: 'User', key: 'user',
      render: (_, r) => <div>
        <Text style={{ color: '#fff', fontSize: 12 }}>{r.email}</Text><br/>
        <Text style={{ color: '#848e9c', fontSize: 10 }}>{r.uid}</Text>
      </div> },
    { title: 'Coin', dataIndex: 'symbol', key: 'coin', width: 80,
      render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Network', dataIndex: 'network', key: 'network', width: 90,
      render: v => <Tag>{v}</Tag> },
    { title: 'Amount', dataIndex: 'amount', key: 'amount',
      render: (v, r) => <Text style={{ color: '#0ecb81', fontWeight: 600 }}>
        {parseFloat(v).toFixed(6)} {r.symbol}
      </Text> },
    { title: 'TX Hash', dataIndex: 'txhash', key: 'txhash',
      render: v => v ? (
        <Text copyable={{ text: v }} style={{ color: '#1890ff', fontSize: 11 }}>
          {v?.slice(0,8)}...{v?.slice(-6)}
        </Text>
      ) : '-' },
    { title: 'From', dataIndex: 'from_address', key: 'from',
      render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>
        {v ? `${v.slice(0,8)}...${v.slice(-4)}` : '-'}
      </Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: v => <Tag color={v === 'completed' ? 'green' : v === 'pending' ? 'orange' : 'red'}>
        {v}
      </Tag> },
    { title: 'Time', dataIndex: 'created_at', key: 'time', width: 120,
      render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>
        {new Date(v).toLocaleString()}
      </Text> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    marginBottom: 16, alignItems: 'center' }}>
        <Text strong style={{ color: '#fff', fontSize: 18 }}>📥 Deposit Management</Text>
        <Button icon={<ReloadOutlined />} onClick={loadDeposits}>Refresh</Button>
      </div>

      {/* Filters */}
      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36', marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}>
            <Input.Search placeholder="Search email, txhash, address..."
              prefix={<SearchOutlined />} allowClear
              onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} />
          </Col>
          <Col xs={12} sm={4}>
            <Select style={{ width: '100%' }} placeholder="Coin" allowClear
              onChange={v => setFilters({ ...filters, coin: v || '', page: 1 })}>
              {['USDT','BTC','ETH','BNB','VDC'].map(c => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={4}>
            <Select style={{ width: '100%' }} placeholder="Network" allowClear
              onChange={v => setFilters({ ...filters, network: v || '', page: 1 })}>
              {['BSC','ETH','VDCHAIN'].map(n => (
                <Select.Option key={n} value={n}>{n}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={4}>
            <Select style={{ width: '100%' }} placeholder="Status" allowClear
              onChange={v => setFilters({ ...filters, status: v || '', page: 1 })}>
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="pending">Pending</Select.Option>
              <Select.Option value="failed">Failed</Select.Option>
            </Select>
          </Col>
          <Col xs={12} sm={4}>
            <Select style={{ width: '100%' }} placeholder="Period"
              onChange={v => setFilters({ ...filters, days: v, page: 1 })}>
              <Select.Option value={7}>Last 7 days</Select.Option>
              <Select.Option value={30}>Last 30 days</Select.Option>
              <Select.Option value={90}>Last 90 days</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
        <Table dataSource={deposits} columns={columns} rowKey="id"
          loading={loading} scroll={{ x: 1000 }}
          pagination={{
            total, pageSize: filters.limit, current: filters.page,
            onChange: page => setFilters({ ...filters, page }),
            showTotal: t => <Text style={{ color: '#848e9c' }}>Total {t}</Text>
          }} />
      </Card>
    </div>
  );
}
