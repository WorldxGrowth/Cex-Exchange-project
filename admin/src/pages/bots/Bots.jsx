import { useEffect, useState } from 'react';
import {
  Card, Table, Button, Tag, Space, Typography, Row, Col,
  Modal, Form, Input, InputNumber, Select, Switch, Tabs,
  message, Popconfirm, Drawer, Badge, Tooltip, Divider
} from 'antd';
import {
  RobotOutlined, PlayCircleOutlined, PauseCircleOutlined,
  PlusOutlined, EditOutlined, StopOutlined, ReloadOutlined,
  DollarOutlined, ThunderboltOutlined, BarChartOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { adminAPI } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

export default function Bots() {
  const [bots, setBots] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBot, setEditBot] = useState(null);
  const [ordersDrawer, setOrdersDrawer] = useState({ open: false, bot: null, orders: [] });
  const [tradesDrawer, setTradesDrawer] = useState({ open: false, bot: null, trades: [] });
  const [allocDrawer, setAllocDrawer] = useState({ open: false, bot: null });
  const [pairs, setPairs] = useState([]);
  const [form] = Form.useForm();
  const [allocForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [botsRes, statsRes, pairsRes] = await Promise.all([
        adminAPI.getBots(),
        adminAPI.getBotStats(),
        adminAPI.getPairs()
      ]);
      setBots(botsRes.data || []);
      setStats(statsRes.data || {});
      setPairs(pairsRes.data || []);
    } catch (e) {
      message.error('Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (bot) => {
    try {
      const res = await adminAPI.toggleBot(bot.id);
      message.success(`Bot ${res.data.is_active ? 'started' : 'paused'}`);
      load();
    } catch { message.error('Failed'); }
  };

  const handleCancelOrders = async (botId) => {
    try {
      const res = await adminAPI.cancelBotOrders(botId);
      message.success(`${res.data.cancelled} orders cancelled`);
      load();
    } catch { message.error('Failed'); }
  };

  const handleResetDaily = async (botId) => {
    try {
      await adminAPI.resetBotDaily(botId);
      message.success('Daily counters reset');
      load();
    } catch { message.error('Failed'); }
  };

  const handleSave = async (values) => {
    try {
      if (editBot) {
        await adminAPI.updateBot(editBot.id, values);
        message.success('Bot updated');
      } else {
        await adminAPI.createBot(values);
        message.success('Bot created');
      }
      setModalOpen(false);
      form.resetFields();
      setEditBot(null);
      load();
    } catch (e) {
      message.error(e?.message || 'Failed');
    }
  };

  const openEdit = (bot) => {
    setEditBot(bot);
    form.setFieldsValue({ ...bot,
      expires_at: bot.expires_at ? bot.expires_at.slice(0, 16) : undefined
    });
    setModalOpen(true);
  };

  const openOrders = async (bot) => {
    try {
      const res = await adminAPI.getBotOrders(bot.id);
      setOrdersDrawer({ open: true, bot, orders: res.data || [] });
    } catch { message.error('Failed'); }
  };

  const openTrades = async (bot) => {
    try {
      const res = await adminAPI.getBotTrades(bot.id);
      setTradesDrawer({ open: true, bot, trades: res.data || [] });
    } catch { message.error('Failed'); }
  };

  const handleAllocate = async (values) => {
    try {
      await adminAPI.allocateBotBalance(allocDrawer.bot.id, values);
      message.success('Balance updated');
      setAllocDrawer({ open: false, bot: null });
      allocForm.resetFields();
      load();
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60,
      render: v => <Text style={{ color: '#848e9c' }}>#{v}</Text> },
    { title: 'Pair', dataIndex: 'pair_symbol', width: 100,
      render: v => <Tag color="blue" style={{ fontWeight: 700 }}>{v}</Tag> },
    { title: 'Mode', dataIndex: 'mode', width: 130,
      render: v => <Tag color={v === 'liquidity_only' ? 'cyan' : 'purple'}>
        {v === 'liquidity_only' ? 'Liquidity' : 'Stabilize'}
      </Tag> },
    { title: 'Status', dataIndex: 'is_active', width: 90,
      render: v => <Badge status={v ? 'success' : 'warning'}
        text={<Text style={{ color: v ? '#0ecb81' : '#f0b90b' }}>{v ? 'Active' : 'Paused'}</Text>} /> },
    { title: 'Target Price', dataIndex: 'target_price', width: 110,
      render: v => <Text style={{ color: '#f0b90b' }}>${parseFloat(v || 0).toFixed(4)}</Text> },
    { title: 'Spread', dataIndex: 'spread_pct', width: 80,
      render: v => <Text style={{ color: '#fff' }}>{v}%</Text> },
    { title: 'Open Orders', key: 'orders', width: 110,
      render: (_, r) => <Space>
        <Tag color="green">{r.open_buy_orders || 0}B</Tag>
        <Tag color="red">{r.open_sell_orders || 0}S</Tag>
      </Space> },
    { title: 'Today Vol', dataIndex: 'today_volume', width: 100,
      render: v => <Text style={{ color: '#0ecb81' }}>${parseFloat(v || 0).toFixed(2)}</Text> },
    { title: 'Bot Balance', key: 'balance', width: 150,
      render: (_, r) => <Space direction="vertical" size={0}>
        <Text style={{ fontSize: 11, color: '#0ecb81' }}>
          {parseFloat(r.bot_token_available || 0).toFixed(2)} {r.base_symbol}
        </Text>
        <Text style={{ fontSize: 11, color: '#f0b90b' }}>
          {parseFloat(r.bot_usdt_available || 0).toFixed(2)} USDT
        </Text>
      </Space> },
    { title: 'Actions', key: 'actions', width: 220, fixed: 'right',
      render: (_, r) => <Space size={4} wrap>
        <Tooltip title={r.is_active ? 'Pause' : 'Start'}>
          <Button size="small"
            icon={r.is_active ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            style={{ background: r.is_active ? '#f0b90b22' : '#0ecb8122',
              borderColor: r.is_active ? '#f0b90b' : '#0ecb81',
              color: r.is_active ? '#f0b90b' : '#0ecb81' }}
            onClick={() => handleToggle(r)} />
        </Tooltip>
        <Tooltip title="Edit">
          <Button size="small" icon={<EditOutlined />}
            onClick={() => openEdit(r)}
            style={{ borderColor: '#848e9c', color: '#848e9c' }} />
        </Tooltip>
        <Tooltip title="Orders">
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => openOrders(r)}
            style={{ borderColor: '#1890ff', color: '#1890ff' }} />
        </Tooltip>
        <Tooltip title="Trades">
          <Button size="small" icon={<BarChartOutlined />}
            onClick={() => openTrades(r)}
            style={{ borderColor: '#722ed1', color: '#722ed1' }} />
        </Tooltip>
        <Tooltip title="Allocate Balance">
          <Button size="small" icon={<DollarOutlined />}
            onClick={() => setAllocDrawer({ open: true, bot: r })}
            style={{ borderColor: '#13c2c2', color: '#13c2c2' }} />
        </Tooltip>
        <Popconfirm title="Cancel all open orders?" onConfirm={() => handleCancelOrders(r.id)}>
          <Tooltip title="Cancel All Orders">
            <Button size="small" icon={<StopOutlined />} danger />
          </Tooltip>
        </Popconfirm>
        <Tooltip title="Reset Daily">
          <Button size="small" icon={<ReloadOutlined />}
            onClick={() => handleResetDaily(r.id)}
            style={{ borderColor: '#fa8c16', color: '#fa8c16' }} />
        </Tooltip>
      </Space> }
  ];

  const orderColumns = [
    { title: 'Side', dataIndex: 'side', width: 70,
      render: v => <Tag color={v === 'buy' ? 'green' : 'red'}>{v?.toUpperCase()}</Tag> },
    { title: 'Price', dataIndex: 'price', width: 100,
      render: v => <Text style={{ color: '#f0b90b' }}>{parseFloat(v).toFixed(4)}</Text> },
    { title: 'Qty', dataIndex: 'quantity', width: 90,
      render: v => parseFloat(v).toFixed(2) },
    { title: 'Remaining', dataIndex: 'remaining_qty', width: 90,
      render: v => parseFloat(v).toFixed(2) },
    { title: 'Status', dataIndex: 'status', width: 100,
      render: v => <Tag color={v==='open'?'blue':v==='filled'?'green':'orange'}>{v}</Tag> },
    { title: 'Time', dataIndex: 'created_at', width: 130,
      render: v => new Date(v).toLocaleString([],
        { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) }
  ];

  const tradeColumns = [
    { title: 'Bot Side', dataIndex: 'bot_side', width: 90,
      render: v => <Tag color={v==='buy'?'green':'red'}>{v?.toUpperCase()}</Tag> },
    { title: 'Price', dataIndex: 'price', width: 100,
      render: v => <Text style={{ color: '#f0b90b' }}>{parseFloat(v).toFixed(4)}</Text> },
    { title: 'Qty', dataIndex: 'quantity', width: 90,
      render: v => parseFloat(v).toFixed(2) },
    { title: 'Total', dataIndex: 'total_value', width: 100,
      render: v => <Text style={{ color: '#0ecb81' }}>${parseFloat(v).toFixed(4)}</Text> },
    { title: 'Time', dataIndex: 'created_at', width: 130,
      render: v => new Date(v).toLocaleString([],
        { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) }
  ];

  // Tab items for Ant Design v5/v6
  const tabItems = [
    {
      key: '1', label: 'Basic',
      children: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="pair_id" label={<Text style={{color:'#848e9c'}}>Pair</Text>}
              rules={[{ required: true }]}>
              <Select placeholder="Select pair" disabled={!!editBot}>
                {pairs.map(p => <Option key={p.id} value={p.id}>{p.symbol}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="mode" label={<Text style={{color:'#848e9c'}}>Mode</Text>}
              initialValue="liquidity_only">
              <Select>
                <Option value="liquidity_only">Liquidity Only</Option>
                <Option value="price_stabilize">Price Stabilize</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="bot_user_id" label={<Text style={{color:'#848e9c'}}>Bot User ID</Text>}
              rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} placeholder="5" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="owner_user_id" label={<Text style={{color:'#848e9c'}}>Owner User ID</Text>}>
              <InputNumber style={{ width: '100%' }} placeholder="1" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="is_active" label={<Text style={{color:'#848e9c'}}>Active</Text>}
              valuePropName="checked" initialValue={false}>
              <Switch checkedChildren="ON" unCheckedChildren="OFF" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="expires_at" label={<Text style={{color:'#848e9c'}}>Expires At</Text>}>
              <Input type="datetime-local" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="notes" label={<Text style={{color:'#848e9c'}}>Notes</Text>}>
              <Input.TextArea rows={2} placeholder="Admin notes..." />
            </Form.Item>
          </Col>
        </Row>
      )
    },
    {
      key: '2', label: 'Price & Spread',
      children: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="target_price" label={<Text style={{color:'#848e9c'}}>Target Price</Text>}>
              <InputNumber style={{ width: '100%' }} step={0.001} placeholder="0.300" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="spread_pct" label={<Text style={{color:'#848e9c'}}>Spread %</Text>}
              initialValue={2}>
              <InputNumber style={{ width: '100%' }} min={0.1} max={20} step={0.1} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="min_price" label={<Text style={{color:'#848e9c'}}>Min Price</Text>}>
              <InputNumber style={{ width: '100%' }} step={0.001} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="max_price" label={<Text style={{color:'#848e9c'}}>Max Price</Text>}>
              <InputNumber style={{ width: '100%' }} step={0.001} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="price_random_pct"
              label={<Text style={{color:'#848e9c'}}>Price Random %</Text>} initialValue={0.5}>
              <InputNumber style={{ width: '100%' }} min={0} max={5} step={0.1} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="pause_on_price_outside_range"
              label={<Text style={{color:'#848e9c'}}>Pause if Out of Range</Text>}
              valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      )
    },
    {
      key: '3', label: 'Qty & Timing',
      children: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="order_qty_min" label={<Text style={{color:'#848e9c'}}>Min Qty</Text>}
              initialValue={20}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="order_qty_max" label={<Text style={{color:'#848e9c'}}>Max Qty</Text>}
              initialValue={25}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="qty_random_pct"
              label={<Text style={{color:'#848e9c'}}>Qty Random %</Text>} initialValue={0.5}>
              <InputNumber style={{ width: '100%' }} min={0} max={50} step={0.5} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="order_lifetime_sec"
              label={<Text style={{color:'#848e9c'}}>Order Lifetime (sec)</Text>} initialValue={1800}>
              <InputNumber style={{ width: '100%' }} min={60} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="interval_min"
              label={<Text style={{color:'#848e9c'}}>Interval Min (sec)</Text>} initialValue={30}>
              <InputNumber style={{ width: '100%' }} min={5} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="interval_max"
              label={<Text style={{color:'#848e9c'}}>Interval Max (sec)</Text>} initialValue={60}>
              <InputNumber style={{ width: '100%' }} min={5} />
            </Form.Item>
          </Col>
        </Row>
      )
    },
    {
      key: '4', label: 'Order Limits',
      children: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="max_open_orders"
              label={<Text style={{color:'#848e9c'}}>Max Open Orders</Text>} initialValue={12}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="max_open_buy_orders"
              label={<Text style={{color:'#848e9c'}}>Max Buy Orders</Text>} initialValue={6}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="max_open_sell_orders"
              label={<Text style={{color:'#848e9c'}}>Max Sell Orders</Text>} initialValue={6}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="daily_order_limit"
              label={<Text style={{color:'#848e9c'}}>Daily Order Limit</Text>} initialValue={1000}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="daily_volume_limit"
              label={<Text style={{color:'#848e9c'}}>Daily Volume Limit (USDT)</Text>} initialValue={0}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="max_single_order_usdt"
              label={<Text style={{color:'#848e9c'}}>Max Single Order (USDT)</Text>} initialValue={0}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
        </Row>
      )
    },
    {
      key: '5', label: 'Risk & Budget',
      children: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="allow_buy" label={<Text style={{color:'#848e9c'}}>Allow Buy</Text>}
              valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="YES" unCheckedChildren="NO" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="allow_sell" label={<Text style={{color:'#848e9c'}}>Allow Sell</Text>}
              valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="YES" unCheckedChildren="NO" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="min_balance_usdt"
              label={<Text style={{color:'#848e9c'}}>Min Balance USDT</Text>} initialValue={0}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="min_balance_token"
              label={<Text style={{color:'#848e9c'}}>Min Balance Token</Text>} initialValue={0}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="pause_on_low_balance"
              label={<Text style={{color:'#848e9c'}}>Pause on Low Balance</Text>}
              valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="total_token_budget"
              label={<Text style={{color:'#848e9c'}}>Token Budget</Text>} initialValue={0}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="total_usdt_budget"
              label={<Text style={{color:'#848e9c'}}>USDT Budget</Text>} initialValue={0}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
        </Row>
      )
    }
  ];

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#fff' }}>
          <RobotOutlined style={{ marginRight: 8, color: '#f0b90b' }} />
          Market Maker Bots
        </Title>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditBot(null); form.resetFields(); setModalOpen(true); }}
          style={{ background: '#f0b90b', border: 'none', color: '#000', fontWeight: 700 }}>
          New Bot
        </Button>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Bots', value: stats.total_bots || 0, color: '#f0b90b' },
          { title: 'Active', value: stats.active_bots || 0, color: '#0ecb81' },
          { title: 'Open Bot Orders', value: stats.total_open_bot_orders || 0, color: '#1890ff' },
          { title: 'Today Trades', value: stats.today_trades || 0, color: '#722ed1' },
          { title: 'Today Volume', value: `$${parseFloat(stats.today_volume || 0).toFixed(2)}`, color: '#13c2c2' },
          { title: 'Paused', value: stats.paused_bots || 0, color: '#fa8c16' },
        ].map((s, i) => (
          <Col xs={12} sm={8} lg={4} key={i}>
            <Card style={{ background: '#1e2026', border: '1px solid #2b2f36', borderRadius: 8 }}
              styles={{ body: { padding: '16px 20px' } }}>
              <div style={{ fontSize: 11, color: '#848e9c', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Bots Table */}
      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ color: '#848e9c', fontSize: 13 }}>{bots.length} bots configured</Text>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}
            style={{ borderColor: '#2b2f36', color: '#848e9c' }}>Refresh</Button>
        </div>
        <Table dataSource={bots} columns={columns} rowKey="id"
          loading={loading} scroll={{ x: 1200 }} pagination={{ pageSize: 20 }} />
      </Card>

      {/* CREATE/EDIT MODAL */}
      <Modal
        title={
          <span style={{ color: '#fff' }}>
            <RobotOutlined style={{ color: '#f0b90b', marginRight: 8 }} />
            {editBot ? `Edit Bot #${editBot.id}` : 'Create New Bot'}
          </span>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditBot(null); form.resetFields(); }}
        footer={null} width={720}
        styles={{ content: { background: '#1e2026', borderRadius: 12 },
                  header: { background: '#1e2026', borderBottom: '1px solid #2b2f36' } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Tabs defaultActiveKey="1" items={tabItems} />
          <Divider style={{ borderColor: '#2b2f36' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit"
              style={{ background: '#f0b90b', border: 'none', color: '#000', fontWeight: 700 }}>
              {editBot ? 'Update Bot' : 'Create Bot'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ORDERS DRAWER */}
      <Drawer
        title={<span style={{ color: '#fff' }}>Bot #{ordersDrawer.bot?.id} Orders — {ordersDrawer.bot?.pair_symbol}</span>}
        open={ordersDrawer.open}
        onClose={() => setOrdersDrawer({ open: false, bot: null, orders: [] })}
        width={700}
        styles={{ body: { background: '#0b0e11' },
                  header: { background: '#1e2026', borderBottom: '1px solid #2b2f36' } }}
      >
        <Table dataSource={ordersDrawer.orders} columns={orderColumns}
          rowKey="id" size="small" pagination={{ pageSize: 20 }} />
      </Drawer>

      {/* TRADES DRAWER */}
      <Drawer
        title={<span style={{ color: '#fff' }}>Bot #{tradesDrawer.bot?.id} Trades — {tradesDrawer.bot?.pair_symbol}</span>}
        open={tradesDrawer.open}
        onClose={() => setTradesDrawer({ open: false, bot: null, trades: [] })}
        width={700}
        styles={{ body: { background: '#0b0e11' },
                  header: { background: '#1e2026', borderBottom: '1px solid #2b2f36' } }}
      >
        <Table dataSource={tradesDrawer.trades} columns={tradeColumns}
          rowKey="trade_id" size="small" pagination={{ pageSize: 20 }} />
      </Drawer>

      {/* ALLOCATE BALANCE DRAWER */}
      <Drawer
        title={<span style={{ color: '#fff' }}>
          <DollarOutlined style={{ color: '#13c2c2', marginRight: 8 }} />
          Allocate Balance — Bot #{allocDrawer.bot?.id}
        </span>}
        open={allocDrawer.open}
        onClose={() => { setAllocDrawer({ open: false, bot: null }); allocForm.resetFields(); }}
        width={400}
        styles={{ body: { background: '#0b0e11' },
                  header: { background: '#1e2026', borderBottom: '1px solid #2b2f36' } }}
      >
        {allocDrawer.bot && (
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={12}>
              <Card size="small" style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
                <Text style={{ color: '#848e9c', fontSize: 11 }}>{allocDrawer.bot.base_symbol} Available</Text>
                <div style={{ color: '#0ecb81', fontSize: 18, fontWeight: 700 }}>
                  {parseFloat(allocDrawer.bot.bot_token_available || 0).toFixed(4)}
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
                <Text style={{ color: '#848e9c', fontSize: 11 }}>USDT Available</Text>
                <div style={{ color: '#f0b90b', fontSize: 18, fontWeight: 700 }}>
                  {parseFloat(allocDrawer.bot.bot_usdt_available || 0).toFixed(4)}
                </div>
              </Card>
            </Col>
          </Row>
        )}
        <Form form={allocForm} layout="vertical" onFinish={handleAllocate}>
          <Form.Item name="coin_id" label={<Text style={{color:'#848e9c'}}>Coin</Text>}
            rules={[{ required: true }]}>
            <Select placeholder="Select coin">
              <Option value={allocDrawer.bot?.pair_id}>{allocDrawer.bot?.base_symbol}</Option>
              <Option value={1}>USDT</Option>
            </Select>
          </Form.Item>
          <Form.Item name="amount" label={<Text style={{color:'#848e9c'}}>Amount</Text>}
            rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={10} placeholder="100" />
          </Form.Item>
          <Form.Item name="action" label={<Text style={{color:'#848e9c'}}>Action</Text>}
            initialValue="add">
            <Select>
              <Option value="add">Add Balance</Option>
              <Option value="remove">Remove Balance</Option>
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" block
            style={{ background: '#13c2c2', border: 'none', color: '#000', fontWeight: 700 }}>
            Update Balance
          </Button>
        </Form>
      </Drawer>
    </div>
  );
}
