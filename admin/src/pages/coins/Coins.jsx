import { CoinAvatar } from '../../utils/coinUtils';
import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Form, Input,
         Select, Space, message, Card, Switch, InputNumber,
         Tabs, Tooltip, Popconfirm, Empty, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, WarningOutlined,
         GlobalOutlined, DeleteOutlined, ThunderboltOutlined,
         SearchOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function Coins() {
  const [coins, setCoins] = useState([]);
  const [networks, setNetworks] = useState([]); // for dropdown in Add Network form
  const [loading, setLoading] = useState(true);

  // ── Search & Filter ──
  const [searchText, setSearchText] = useState('');
  const [filterDeposit, setFilterDeposit] = useState('all');   // all | enabled | disabled
  const [filterWithdraw, setFilterWithdraw] = useState('all');
  const [filterTrade, setFilterTrade] = useState('all');
  const [filterActive, setFilterActive] = useState('all');
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // ── Networks modal (per-coin coin_networks CRUD) ──
  const [networksModal, setNetworksModal] = useState(false);
  const [networksCoin, setNetworksCoin] = useState(null); // which coin we're managing
  const [coinNetworksList, setCoinNetworksList] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [addNetworkModal, setAddNetworkModal] = useState(false);
  const [editNetworkRecord, setEditNetworkRecord] = useState(null);
  const [networkForm] = Form.useForm();

  // ── Futures pair (loaded inside Edit modal's Futures tab) ──
  const [futuresPair, setFuturesPair] = useState(null);
  const [futuresLoading, setFuturesLoading] = useState(false);
  const [futuresForm] = Form.useForm();
  const [creatingFutures, setCreatingFutures] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getCoins();
      setCoins(res.data || []);
    } catch (e) {}
    setLoading(false);
  };

  const fetchNetworksList = async () => {
    try {
      const res = await adminAPI.getNetworks();
      setNetworks(res.data || []);
    } catch (e) {}
  };

  useEffect(() => { fetch(); fetchNetworksList(); }, []);

  // ── Add / Edit Coin (basic) ──
  const handleAdd = async (values) => {
    try {
      await adminAPI.addCoin(values);
      message.success('Coin added! Now add its supported networks from the "Networks" button.');
      setAddModal(false);
      addForm.resetFields();
      fetch();
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  const handleEdit = async (values) => {
    try {
      await adminAPI.updateCoin(editRecord.id, values);
      message.success('Updated!');
      setEditModal(false);
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const openEdit = async (r) => {
    setEditRecord(r);
    editForm.setFieldsValue({
      name:            r.name,
      logo_url:        r.logo_url,
      coin_type:       r.coin_type,
      is_active:       r.is_active,
      is_deposit:      r.is_deposit,
      is_withdraw:     r.is_withdraw,
      is_tradeable:    r.is_tradeable,
      maintenance_mode: r.maintenance_mode,
      min_deposit:     parseFloat(r.min_deposit || 0),
      min_withdraw:    parseFloat(r.min_withdraw || 0),
      withdraw_fee:    parseFloat(r.withdraw_fee || 0),
      deposit_disabled_reason: r.deposit_disabled_reason,
      withdraw_disabled_reason: r.withdraw_disabled_reason,
      trade_disabled_reason: r.trade_disabled_reason,
      deposit_notice:  r.deposit_notice,
      withdraw_notice: r.withdraw_notice,
      trade_notice:    r.trade_notice,
      deposit_enabled_at:  r.deposit_enabled_at?.slice(0,16),
      withdraw_enabled_at: r.withdraw_enabled_at?.slice(0,16),
      trade_enabled_at:    r.trade_enabled_at?.slice(0,16),
      price_source:    r.price_source,
      price_symbol:    r.price_symbol,
      sort_order:      r.sort_order,
    });
    setEditModal(true);
    loadFuturesForCoin(r.id);
  };

  const handleToggle = async (id, field, value) => {
    try {
      await adminAPI.updateCoin(id, { [field]: value });
      message.success('Updated!');
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  // ── Coin Networks (multi-chain) ──
  const openNetworksModal = async (coin) => {
    setNetworksCoin(coin);
    setNetworksModal(true);
    await loadCoinNetworks(coin.id);
  };

  const loadCoinNetworks = async (coinId) => {
    setNetworksLoading(true);
    try {
      const res = await adminAPI.getCoinNetworks(coinId);
      setCoinNetworksList(res.data || []);
    } catch (e) { message.error('Failed to load networks'); }
    setNetworksLoading(false);
  };

  const openAddNetwork = () => {
    setEditNetworkRecord(null);
    networkForm.resetFields();
    networkForm.setFieldsValue({
      decimals: 18, min_confirmations: 3,
      is_deposit_enabled: true, is_withdraw_enabled: true, withdraw_fee: 0,
    });
    setAddNetworkModal(true);
  };

  const openEditNetwork = (record) => {
    setEditNetworkRecord(record);
    networkForm.setFieldsValue({
      network_id: record.network_id,
      contract_address: record.contract_address,
      decimals: record.decimals,
      min_confirmations: record.min_confirmations,
      is_deposit_enabled: record.is_deposit_enabled,
      is_withdraw_enabled: record.is_withdraw_enabled,
      withdraw_fee: parseFloat(record.withdraw_fee || 0),
    });
    setAddNetworkModal(true);
  };

  const handleNetworkSubmit = async (values) => {
    try {
      if (editNetworkRecord) {
        // Update existing - network_id can't change (it's the identity of the mapping)
        const { network_id, ...rest } = values;
        await adminAPI.updateCoinNetwork(editNetworkRecord.id, rest);
        message.success('Network settings updated!');
      } else {
        await adminAPI.addCoinNetwork(networksCoin.id, values);
        message.success('Network added to coin!');
      }
      setAddNetworkModal(false);
      networkForm.resetFields();
      loadCoinNetworks(networksCoin.id);
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  const handleDeleteNetwork = async (id) => {
    try {
      await adminAPI.deleteCoinNetwork(id);
      message.success('Network removed from coin');
      loadCoinNetworks(networksCoin.id);
    } catch (e) { message.error('Failed'); }
  };

  const handleNetworkToggle = async (id, field, value) => {
    try {
      await adminAPI.updateCoinNetwork(id, { [field]: value });
      message.success('Updated!');
      loadCoinNetworks(networksCoin.id);
    } catch (e) { message.error('Failed'); }
  };

  // ── Futures Pair (loaded inside Edit Coin modal) ──
  const loadFuturesForCoin = async (coinId) => {
    setFuturesLoading(true);
    setFuturesPair(null);
    try {
      const res = await adminAPI.getFuturesPairs({ base_coin_id: coinId });
      const pair = (res.data || [])[0] || null;
      setFuturesPair(pair);
      if (pair) {
        futuresForm.setFieldsValue({
          futures_enabled: pair.futures_enabled,
          is_custom: pair.is_custom,
          max_leverage: parseFloat(pair.max_leverage),
          maker_fee: parseFloat(pair.maker_fee),
          taker_fee: parseFloat(pair.taker_fee),
          min_qty: parseFloat(pair.min_qty),
          min_notional: parseFloat(pair.min_notional),
        });
      }
    } catch (e) {}
    setFuturesLoading(false);
  };

  const handleFuturesUpdate = async (values) => {
    try {
      await adminAPI.updateFuturesPair(futuresPair.id, values);
      message.success('Futures settings updated!');
      loadFuturesForCoin(editRecord.id);
    } catch (e) { message.error('Failed'); }
  };

  const handleCreateFutures = async () => {
    if (!editRecord) return;
    setCreatingFutures(true);
    try {
      const symbol = `${editRecord.symbol}USDT`;
      await adminAPI.addFuturesPair({
        symbol,
        base_coin_id: editRecord.id,
        is_custom: true, // internal engine by default for newly-created custom pairs
        futures_enabled: true,
      });
      message.success(`Futures pair ${symbol} created!`);
      loadFuturesForCoin(editRecord.id);
    } catch (e) { message.error(e?.message || 'Failed to create futures pair'); }
    setCreatingFutures(false);
  };

  // ── Search & Filter logic ──
  const filteredCoins = coins.filter(c => {
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!c.symbol?.toLowerCase().includes(q) && !c.name?.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterDeposit !== 'all' && String(c.is_deposit) !== filterDeposit) return false;
    if (filterWithdraw !== 'all' && String(c.is_withdraw) !== filterWithdraw) return false;
    if (filterTrade !== 'all' && String(c.is_tradeable) !== filterTrade) return false;
    if (filterActive !== 'all' && String(c.is_active) !== filterActive) return false;
    return true;
  });

  // ── Main coins table ──
  const columns = [
    { title: 'Symbol', dataIndex: 'symbol', key: 'sym',
      render: (v, r) => (
        <Space>
          {r.maintenance_mode && <Tooltip title="Maintenance"><WarningOutlined style={{ color: '#f6465d' }} /></Tooltip>}
          <CoinAvatar symbol={v} logoUrl={r.logo_url} size={20} />
          <Tag color="blue">{v}</Tag>
        </Space>
      )
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Price', dataIndex: 'price_usdt', key: 'price',
      render: v => v ? `$${parseFloat(v).toFixed(4)}` : '-' },
    { title: 'Deposit', dataIndex: 'is_deposit', key: 'dep',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleToggle(r.id, 'is_deposit', val)} /> },
    { title: 'Withdraw', dataIndex: 'is_withdraw', key: 'wd',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleToggle(r.id, 'is_withdraw', val)} /> },
    { title: 'Trade', dataIndex: 'is_tradeable', key: 'tr',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleToggle(r.id, 'is_tradeable', val)} /> },
    { title: 'Maintenance', dataIndex: 'maintenance_mode', key: 'maint',
      render: (v, r) => <Switch size="small" checked={v}
        style={{ background: v ? '#f6465d' : undefined }}
        onChange={val => handleToggle(r.id, 'maintenance_mode', val)} /> },
    { title: 'Active', dataIndex: 'is_active', key: 'act',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleToggle(r.id, 'is_active', val)} /> },
    { title: 'Networks', key: 'networks',
      render: (_, r) => (
        <Button size="small" icon={<GlobalOutlined />} onClick={() => openNetworksModal(r)}>
          Manage
        </Button>
      ) },
    { title: 'Edit', key: 'edit',
      render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /> },
  ];

  // ── coin_networks sub-table columns ──
  const networkColumns = [
    { title: 'Network', dataIndex: 'network_name', key: 'net',
      render: (v, r) => <Tag color="purple">{r.short_name} — {v}</Tag> },
    { title: 'Chain Type', dataIndex: 'chain_type', key: 'ct',
      render: v => <Tag>{v}</Tag> },
    { title: 'Contract Address', dataIndex: 'contract_address', key: 'addr',
      render: v => v
        ? <Tooltip title={v}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.slice(0,8)}...{v.slice(-6)}</span></Tooltip>
        : <Tag color="default">Native</Tag> },
    { title: 'Decimals', dataIndex: 'decimals', key: 'dec' },
    { title: 'Min Confirmations', dataIndex: 'min_confirmations', key: 'conf' },
    { title: 'Deposit', dataIndex: 'is_deposit_enabled', key: 'dep',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleNetworkToggle(r.id, 'is_deposit_enabled', val)} /> },
    { title: 'Withdraw', dataIndex: 'is_withdraw_enabled', key: 'wd',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleNetworkToggle(r.id, 'is_withdraw_enabled', val)} /> },
    { title: 'Actions', key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditNetwork(r)} />
          <Popconfirm title="Remove this network from the coin?" onConfirm={() => handleDeleteNetwork(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ) },
  ];

  // ── Edit Coin modal tabs ──
  const EditTabBasic = () => (
    <>
      <Form.Item name="name" label="Name"><Input /></Form.Item>
      <Form.Item name="logo_url" label="Logo URL"><Input placeholder="https://..." /></Form.Item>
      <Form.Item name="coin_type" label="Coin Type">
        <Select>
          <Select.Option value="native">Native</Select.Option>
          <Select.Option value="erc20">ERC20 / Token</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="price_source" label="Price Source">
        <Select>
          <Select.Option value="binance">Binance</Select.Option>
          <Select.Option value="coingecko">CoinGecko</Select.Option>
          <Select.Option value="custom">Custom</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="price_symbol" label="Price Symbol"><Input placeholder="BTCUSDT" /></Form.Item>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Form.Item name="min_deposit" label="Min Deposit">
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="min_withdraw" label="Min Withdraw">
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="withdraw_fee" label="Withdraw Fee">
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="sort_order" label="Sort Order">
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {['is_active','is_deposit','is_withdraw','is_tradeable','maintenance_mode'].map(f => (
          <Form.Item key={f} name={f} label={f.replace(/_/g,' ')} valuePropName="checked">
            <Switch />
          </Form.Item>
        ))}
      </div>
    </>
  );

  const EditTabControls = () => (
    <>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Schedule deposit/withdraw/trade enable time. Leave empty = always available.
      </Typography.Text>
      {['deposit','withdraw','trade'].map(op => (
        <Card key={op} size="small" style={{ marginBottom: 12, background: '#2b2f36', border: '1px solid #444' }}
          title={<Tag color="blue">{op.toUpperCase()}</Tag>}>
          <Form.Item name={`${op}_enabled_at`} label="Enable At (schedule)">
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name={`${op}_disabled_reason`} label="Disabled Reason">
            <Input placeholder="Coming soon..." />
          </Form.Item>
          <Form.Item name={`${op}_notice`} label="Notice (shown to users)">
            <Input placeholder="Deposits temporarily suspended for upgrade" />
          </Form.Item>
        </Card>
      ))}
    </>
  );

  const EditTabFutures = () => {
    if (futuresLoading) return <Typography.Text type="secondary">Loading futures settings...</Typography.Text>;

    if (!futuresPair) {
      return (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            This coin has no futures pair yet. Create one to enable futures trading
            (will run on our internal engine, not Binance passthrough).
          </Typography.Text>
          <Button type="primary" icon={<ThunderboltOutlined />}
            loading={creatingFutures} onClick={handleCreateFutures}>
            Create Futures Pair ({editRecord?.symbol}USDT)
          </Button>
        </div>
      );
    }

    return (
      <Form form={futuresForm} onFinish={handleFuturesUpdate} layout="vertical">
        <Tag color={futuresPair.is_custom ? 'orange' : 'blue'} style={{ marginBottom: 16 }}>
          {futuresPair.symbol} — {futuresPair.is_custom ? 'Internal Engine (Custom)' : 'Binance Passthrough'}
        </Tag>
        <Form.Item name="futures_enabled" label="Futures Trading Enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="is_custom" label="Internal Engine (Custom Token)" valuePropName="checked">
          <Switch />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="max_leverage" label="Max Leverage">
            <InputNumber style={{ width: '100%' }} min={1} max={125} />
          </Form.Item>
          <Form.Item name="min_qty" label="Min Quantity">
            <InputNumber style={{ width: '100%' }} step={0.001} />
          </Form.Item>
          <Form.Item name="min_notional" label="Min Notional (USDT)">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maker_fee" label="Maker Fee">
            <InputNumber style={{ width: '100%' }} step={0.0001} />
          </Form.Item>
          <Form.Item name="taker_fee" label="Taker Fee">
            <InputNumber style={{ width: '100%' }} step={0.0001} />
          </Form.Item>
        </div>
        <Button type="primary" htmlType="submit" block>Update Futures Settings</Button>
      </Form>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          💰 Coins Management
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModal(true)}>
          Add Coin
        </Button>
      </div>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12, marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search by symbol or name..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} md={4}>
            <Select style={{ width: '100%' }} value={filterDeposit} onChange={setFilterDeposit}>
              <Select.Option value="all">Deposit: All</Select.Option>
              <Select.Option value="true">Deposit: On</Select.Option>
              <Select.Option value="false">Deposit: Off</Select.Option>
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select style={{ width: '100%' }} value={filterWithdraw} onChange={setFilterWithdraw}>
              <Select.Option value="all">Withdraw: All</Select.Option>
              <Select.Option value="true">Withdraw: On</Select.Option>
              <Select.Option value="false">Withdraw: Off</Select.Option>
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select style={{ width: '100%' }} value={filterTrade} onChange={setFilterTrade}>
              <Select.Option value="all">Trade: All</Select.Option>
              <Select.Option value="true">Trade: On</Select.Option>
              <Select.Option value="false">Trade: Off</Select.Option>
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select style={{ width: '100%' }} value={filterActive} onChange={setFilterActive}>
              <Select.Option value="all">Active: All</Select.Option>
              <Select.Option value="true">Active: On</Select.Option>
              <Select.Option value="false">Active: Off</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Showing {filteredCoins.length} of {coins.length} coins
        </Typography.Text>
        <Table columns={columns} dataSource={filteredCoins} rowKey="id"
          loading={loading} scroll={{ x: 1100 }} />
      </Card>

      {/* Add Coin Modal — network_id removed, networks managed separately now */}
      <Modal title="Add New Coin" open={addModal}
        onCancel={() => setAddModal(false)} footer={null} width={500}>
        <Form form={addForm} onFinish={handleAdd} layout="vertical">
          <Form.Item name="symbol" label="Symbol" rules={[{ required: true }]}>
            <Input placeholder="BTC" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Bitcoin" />
          </Form.Item>
          <Form.Item name="coin_type" label="Coin Type" initialValue="erc20">
            <Select>
              <Select.Option value="native">Native</Select.Option>
              <Select.Option value="erc20">ERC20 / Token</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="price_source" label="Price Source" initialValue="binance">
            <Select>
              <Select.Option value="binance">Binance</Select.Option>
              <Select.Option value="custom">Custom</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="price_symbol" label="Price Symbol"><Input placeholder="BTCUSDT" /></Form.Item>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            After creating, use the "Networks" button on the coin row to add which
            blockchains this coin supports (with contract address per chain).
          </Typography.Text>
          <Button type="primary" htmlType="submit" block>Add Coin</Button>
        </Form>
      </Modal>

      {/* Edit Coin Modal */}
      <Modal title={`Edit: ${editRecord?.symbol}`} open={editModal}
        onCancel={() => setEditModal(false)} footer={null} width={650}>
        <Form form={editForm} onFinish={handleEdit} layout="vertical">
          <Tabs items={[
            { key: 'basic',    label: 'Basic',    children: <EditTabBasic /> },
            { key: 'controls', label: 'Controls', children: <EditTabControls /> },
          ]} />
          <Button type="primary" htmlType="submit" block style={{ marginTop: 12 }}>
            Update Coin
          </Button>
        </Form>
        {/* Futures tab is OUTSIDE the basic Form because it submits to a different
            endpoint (futures_pairs, not coins) - kept as its own mini-form below */}
        <div style={{ marginTop: 20, borderTop: '1px solid #303030', paddingTop: 20 }}>
          <Typography.Title level={5} style={{ color: '#fff' }}>⚡ Futures Trading</Typography.Title>
          <EditTabFutures />
        </div>
      </Modal>

      {/* Coin Networks Modal */}
      <Modal title={`Networks for ${networksCoin?.symbol}`} open={networksModal}
        onCancel={() => setNetworksModal(false)} footer={null} width={950}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddNetwork}>
            Add Network
          </Button>
        </div>
        <Table columns={networkColumns} dataSource={coinNetworksList} rowKey="id"
          loading={networksLoading} pagination={false}
          locale={{ emptyText: <Empty description="No networks added yet for this coin" /> }} />
      </Modal>

      {/* Add/Edit Network Modal */}
      <Modal title={editNetworkRecord ? 'Edit Network Settings' : 'Add Network to Coin'}
        open={addNetworkModal} onCancel={() => setAddNetworkModal(false)} footer={null} width={500}>
        <Form form={networkForm} onFinish={handleNetworkSubmit} layout="vertical">
          <Form.Item name="network_id" label="Network" rules={[{ required: true }]}>
            <Select disabled={!!editNetworkRecord} placeholder="Select network">
              {networks.map(n => (
                <Select.Option key={n.id} value={n.id}>{n.short_name} — {n.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="contract_address" label="Contract Address (leave empty for native coin)">
            <Input placeholder="0x... or T... (leave empty if native)" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="decimals" label="Decimals" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} max={18} />
            </Form.Item>
            <Form.Item name="min_confirmations" label="Min Confirmations" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item name="withdraw_fee" label="Withdraw Fee">
              <InputNumber style={{ width: '100%' }} step={0.0001} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <Form.Item name="is_deposit_enabled" label="Deposit Enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="is_withdraw_enabled" label="Withdraw Enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" block>
            {editNetworkRecord ? 'Update' : 'Add Network'}
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
