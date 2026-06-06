import { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Select, Space, message,
  Card, Modal, Form, InputNumber, Radio, Popconfirm,
  Typography, Row, Col, Statistic, Divider
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  ReloadOutlined, ClearOutlined
} from '@ant-design/icons';
import { adminAPI } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

export default function OrderBook() {
  const [pairs, setPairs]           = useState([]);
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selectedPair, setSelectedPair] = useState(null);
  const [sideFilter, setSideFilter] = useState('all');
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal]   = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [rows, setRows]             = useState([
    { side: 'buy', price: '', quantity: '' }
  ]);
  const [editForm] = Form.useForm();

  useEffect(() => {
    adminAPI.getPairs().then(r => setPairs(r.data || []));
  }, []);

  const fetchOrders = async () => {
    if (!selectedPair) return;
    setLoading(true);
    try {
      const params = { pair_id: selectedPair, status: 'open' };
      if (sideFilter !== 'all') params.side = sideFilter;
      const r = await adminAPI.getOrderBook(params);
      setOrders(r.data || []);
    } catch { message.error('Failed to load'); }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [selectedPair, sideFilter]);

  const buyOrders  = orders.filter(o => o.side === 'buy')
    .sort((a,b) => parseFloat(b.price) - parseFloat(a.price));
  const sellOrders = orders.filter(o => o.side === 'sell')
    .sort((a,b) => parseFloat(a.price) - parseFloat(b.price));

  const addRow = () => setRows([...rows, { side: 'buy', price: '', quantity: '' }]);
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => {
    const next = [...rows];
    next[i][field] = val;
    setRows(next);
  };

  const handleCreate = async () => {
    const valid = rows.filter(r => r.price && r.quantity && parseFloat(r.price) > 0 && parseFloat(r.quantity) > 0);
    if (valid.length === 0) { message.error('Add at least one valid order'); return; }
    try {
      const r = await adminAPI.createOrders({ pair_id: selectedPair, orders: valid });
      message.success(r.message || `${r.data?.inserted} orders created`);
      setCreateModal(false);
      setRows([{ side: 'buy', price: '', quantity: '' }]);
      fetchOrders();
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  const handleEdit = async (values) => {
    try {
      await adminAPI.updateOrder(editRecord.id, values);
      message.success('Order updated');
      setEditModal(false);
      fetchOrders();
    } catch { message.error('Failed'); }
  };

  const handleDelete = async (id) => {
    try {
      await adminAPI.deleteOrder(id);
      message.success('Order cancelled');
      fetchOrders();
    } catch { message.error('Failed'); }
  };

  const handleCancelAll = async (side) => {
    try {
      const r = await adminAPI.cancelAllOrders({ pair_id: selectedPair, side: side || undefined });
      message.success(r.data?.cancelled + ' orders cancelled');
      fetchOrders();
    } catch { message.error('Failed'); }
  };

  const cols = [
    { title: 'Side', dataIndex: 'side', width: 80,
      render: v => <Tag color={v==='buy'?'green':'red'}>{v.toUpperCase()}</Tag> },
    { title: 'Price', dataIndex: 'price',
      render: v => parseFloat(v).toFixed(6),
      sorter: (a,b) => parseFloat(a.price) - parseFloat(b.price) },
    { title: 'Quantity', dataIndex: 'quantity',
      render: v => parseFloat(v).toFixed(4) },
    { title: 'Total', dataIndex: 'total_value',
      render: v => parseFloat(v || 0).toFixed(4) + ' USDT' },
    { title: 'Status', dataIndex: 'status',
      render: v => <Tag color={v==='open'?'blue':'default'}>{v}</Tag> },
    { title: 'Created', dataIndex: 'created_at',
      render: v => new Date(v).toLocaleString() },
    { title: 'Action', width: 120, render: (_, rec) => (
      <Space>
        <Button size="small" icon={<EditOutlined />}
          onClick={() => {
            setEditRecord(rec);
            editForm.setFieldsValue({ price: rec.price, quantity: rec.quantity });
            setEditModal(true);
          }} />
        <Popconfirm title="Cancel this order?" onConfirm={() => handleDelete(rec.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )}
  ];

  const pair = pairs.find(p => p.id === selectedPair);

  return (
    <div>
      <Title level={3}>OrderBook Manager</Title>

      {/* Controls */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Text strong>Pair: </Text>
            <Select placeholder="Select pair" style={{ width: 160 }}
              onChange={v => setSelectedPair(v)} value={selectedPair}>
              {pairs.filter(p => p.is_custom || p.symbol === 'VDCUSDT').map(p => (
                <Option key={p.id} value={p.id}>{p.symbol}</Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Text strong>Side: </Text>
            <Radio.Group value={sideFilter} onChange={e => setSideFilter(e.target.value)}>
              <Radio.Button value="all">All</Radio.Button>
              <Radio.Button value="buy">Buy</Radio.Button>
              <Radio.Button value="sell">Sell</Radio.Button>
            </Radio.Group>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchOrders}>Refresh</Button>
              <Button icon={<PlusOutlined />} type="primary"
                onClick={() => setCreateModal(true)}
                disabled={!selectedPair}>
                Add Orders
              </Button>
              <Popconfirm title="Cancel ALL open orders?" onConfirm={() => handleCancelAll()}>
                <Button danger icon={<ClearOutlined />} disabled={!selectedPair}>
                  Cancel All
                </Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Stats */}
      {selectedPair && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card><Statistic title="Total Orders" value={orders.length} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="Buy Orders" value={buyOrders.length}
              valueStyle={{ color: '#0ecb81' }} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="Sell Orders" value={sellOrders.length}
              valueStyle={{ color: '#f6465d' }} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="Best Bid"
              value={buyOrders[0] ? parseFloat(buyOrders[0].price).toFixed(6) : '-'}
              valueStyle={{ color: '#0ecb81' }} /></Card>
          </Col>
        </Row>
      )}

      {/* Table */}
      <Card title={pair ? `${pair.symbol} - Admin Orders` : 'Select a pair'}>
        <Table
          dataSource={orders}
          columns={cols}
          rowKey="id"
          loading={loading}
          size="small"
          rowClassName={r => r.side === 'buy' ? 'buy-row' : 'sell-row'}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* Create Modal */}
      <Modal title="Add Orders" open={createModal} width={700}
        onOk={handleCreate}
        onCancel={() => { setCreateModal(false); setRows([{ side:'buy', price:'', quantity:'' }]); }}
        okText="Create Orders">
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            Add multiple orders at once. Bot will NOT touch these orders.
          </Text>
        </div>
        <Divider />
        {/* Header */}
        <Row gutter={8} style={{ marginBottom: 8, fontWeight: 600 }}>
          <Col span={5}><Text strong>Side</Text></Col>
          <Col span={8}><Text strong>Price (USDT)</Text></Col>
          <Col span={8}><Text strong>Quantity</Text></Col>
          <Col span={3}></Col>
        </Row>
        {rows.map((row, i) => (
          <Row key={i} gutter={8} style={{ marginBottom: 8 }}>
            <Col span={5}>
              <Select value={row.side} onChange={v => updateRow(i, 'side', v)}
                style={{ width: '100%' }}>
                <Option value="buy"><Tag color="green">BUY</Tag></Option>
                <Option value="sell"><Tag color="red">SELL</Tag></Option>
              </Select>
            </Col>
            <Col span={8}>
              <InputNumber value={row.price} min={0} step={0.0001}
                style={{ width: '100%' }} placeholder="0.0000"
                onChange={v => updateRow(i, 'price', v)} />
            </Col>
            <Col span={8}>
              <InputNumber value={row.quantity} min={0}
                style={{ width: '100%' }} placeholder="100"
                onChange={v => updateRow(i, 'quantity', v)} />
            </Col>
            <Col span={3}>
              <Button danger size="small" onClick={() => removeRow(i)}
                disabled={rows.length === 1}>✕</Button>
            </Col>
          </Row>
        ))}
        <Button type="dashed" onClick={addRow} block icon={<PlusOutlined />}
          style={{ marginTop: 8 }}>
          Add Row
        </Button>
      </Modal>

      {/* Edit Modal */}
      <Modal title="Edit Order" open={editModal}
        onOk={() => editForm.validateFields().then(handleEdit)}
        onCancel={() => setEditModal(false)}>
        <Form form={editForm} layout="vertical">
          <Form.Item label="Price" name="price"
            rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.0001} />
          </Form.Item>
          <Form.Item label="Quantity" name="quantity"
            rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
