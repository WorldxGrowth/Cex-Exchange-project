import { CoinAvatar } from '../../utils/coinUtils';
import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Form, Input,
         Select, Space, message, Card, Switch, InputNumber,
         Tabs, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function Coins() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getCoins();
      setCoins(res.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = async (values) => {
    try {
      await adminAPI.addCoin(values);
      message.success('Coin added!');
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

  const openEdit = (r) => {
    setEditRecord(r);
    editForm.setFieldsValue({
      name:            r.name,
      logo_url:        r.logo_url,
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
  };

  const handleToggle = async (id, field, value) => {
    try {
      await adminAPI.updateCoin(id, { [field]: value });
      message.success('Updated!');
      fetch();
    } catch (e) { message.error('Failed'); }
  };

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
    { title: 'Edit', key: 'edit',
      render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /> },
  ];

  const EditTabBasic = () => (
    <>
      <Form.Item name="name" label="Name"><Input /></Form.Item>
      <Form.Item name="logo_url" label="Logo URL"><Input placeholder="https://..." /></Form.Item>
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

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={coins} rowKey="id"
          loading={loading} scroll={{ x: 900 }} />
      </Card>

      {/* Add Modal */}
      <Modal title="Add New Coin" open={addModal}
        onCancel={() => setAddModal(false)} footer={null} width={500}>
        <Form form={addForm} onFinish={handleAdd} layout="vertical">
          <Form.Item name="symbol" label="Symbol" rules={[{ required: true }]}>
            <Input placeholder="BTC" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Bitcoin" />
          </Form.Item>
          <Form.Item name="network_id" label="Network" rules={[{ required: true }]}>
            <Select>
              <Select.Option value={1}>BSC</Select.Option>
              <Select.Option value={2}>ETH</Select.Option>
              <Select.Option value={4}>VDChain</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="price_source" label="Price Source" initialValue="binance">
            <Select>
              <Select.Option value="binance">Binance</Select.Option>
              <Select.Option value="custom">Custom</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="price_symbol" label="Price Symbol"><Input placeholder="BTCUSDT" /></Form.Item>
          <Form.Item name="contract_address" label="Contract Address"><Input placeholder="0x..." /></Form.Item>
          <Button type="primary" htmlType="submit" block>Add Coin</Button>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal title={`Edit: ${editRecord?.symbol}`} open={editModal}
        onCancel={() => setEditModal(false)} footer={null} width={600}>
        <Form form={editForm} onFinish={handleEdit} layout="vertical">
          <Tabs items={[
            { key: 'basic',    label: 'Basic',    children: <EditTabBasic /> },
            { key: 'controls', label: 'Controls', children: <EditTabControls /> },
          ]} />
          <Button type="primary" htmlType="submit" block style={{ marginTop: 12 }}>
            Update Coin
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
