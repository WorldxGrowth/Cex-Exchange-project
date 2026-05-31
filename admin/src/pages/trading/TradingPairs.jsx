import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Form, Input, Select,
         Switch, Space, message, Card, InputNumber, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function TradingPairs() {
  const [pairs, setPairs] = useState([]);
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
      const [pairsRes, coinsRes] = await Promise.all([
        adminAPI.getPairs(), adminAPI.getCoins()
      ]);
      setPairs(pairsRes.data || []);
      setCoins(coinsRes.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = async (values) => {
    try {
      await adminAPI.addPair(values);
      message.success('Pair added!');
      setAddModal(false);
      addForm.resetFields();
      fetch();
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  const handleEdit = async (values) => {
    try {
      await adminAPI.updatePair(editRecord.id, values);
      message.success('Pair updated!');
      setEditModal(false);
      fetch();
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  const openEdit = (record) => {
    setEditRecord(record);
    editForm.setFieldsValue({
      is_active:       record.is_active,
      maker_fee:       parseFloat(record.maker_fee),
      taker_fee:       parseFloat(record.taker_fee),
      min_order_qty:   parseFloat(record.min_order_qty || 0),
      min_order_value: parseFloat(record.min_order_value || 0),
      is_custom:       record.is_custom,
      binance_symbol:  record.binance_symbol,
      pre_listing_mode: record.pre_listing_mode,
      show_countdown:  record.show_countdown,
      trading_notice:  record.trading_notice,
      trading_enabled_at:  record.trading_enabled_at,
      trading_disabled_at: record.trading_disabled_at,
    });
    setEditModal(true);
  };

  const handleToggle = async (id, field, value) => {
    try {
      await adminAPI.updatePair(id, { [field]: value });
      message.success('Updated!');
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const columns = [
    { title: 'Symbol', dataIndex: 'symbol', key: 'sym',
      render: v => <Tag color="blue" style={{ fontWeight: 700 }}>{v}</Tag> },
    { title: 'Type', key: 'type',
      render: (_, r) => r.is_custom
        ? <Tag color="purple">Internal</Tag>
        : <Tag color="orange">Binance</Tag> },
    { title: 'Maker Fee', dataIndex: 'maker_fee', key: 'maker',
      render: v => `${(parseFloat(v)*100).toFixed(2)}%` },
    { title: 'Taker Fee', dataIndex: 'taker_fee', key: 'taker',
      render: v => `${(parseFloat(v)*100).toFixed(2)}%` },
    { title: 'Pre-listing', dataIndex: 'pre_listing_mode', key: 'pre',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleToggle(r.id, 'pre_listing_mode', val)} /> },
    { title: 'Active', dataIndex: 'is_active', key: 'act',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleToggle(r.id, 'is_active', val)} /> },
    { title: 'Actions', key: 'actions',
      render: (_, r) => (
        <Tooltip title="Edit Pair">
          <Button size="small" icon={<EditOutlined />}
            onClick={() => openEdit(r)} />
        </Tooltip>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          🔄 Trading Pairs
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModal(true)}>
          Add Pair
        </Button>
      </div>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={pairs} rowKey="id"
          loading={loading} scroll={{ x: 700 }} />
      </Card>

      {/* Add Modal */}
      <Modal title="Add Trading Pair" open={addModal}
        onCancel={() => setAddModal(false)} footer={null} width={500}>
        <Form form={addForm} onFinish={handleAdd} layout="vertical">
          <Form.Item name="base_coin_id" label="Base Coin" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {coins.map(c => <Select.Option key={c.id} value={c.id}>{c.symbol} - {c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="quote_coin_id" label="Quote Coin" rules={[{ required: true }]}>
            <Select showSearch>
              {coins.filter(c => c.symbol === 'USDT').map(c =>
                <Select.Option key={c.id} value={c.id}>{c.symbol}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="is_custom" label="Type" initialValue={false}>
            <Select>
              <Select.Option value={true}>Internal (VDC etc)</Select.Option>
              <Select.Option value={false}>Binance Pass-through</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="binance_symbol" label="Binance Symbol">
            <Input placeholder="XRPUSDT" />
          </Form.Item>
          <Form.Item name="maker_fee" label="Maker Fee" initialValue={0.001}>
            <InputNumber step={0.0001} precision={4} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="taker_fee" label="Taker Fee" initialValue={0.001}>
            <InputNumber step={0.0001} precision={4} style={{ width: '100%' }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Add Pair</Button>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal title={`Edit: ${editRecord?.symbol}`} open={editModal}
        onCancel={() => setEditModal(false)} footer={null} width={600}>
        <Form form={editForm} onFinish={handleEdit} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="maker_fee" label="Maker Fee">
              <InputNumber step={0.0001} precision={4} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="taker_fee" label="Taker Fee">
              <InputNumber step={0.0001} precision={4} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="min_order_qty" label="Min Order Qty">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="min_order_value" label="Min Order Value ($)">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="binance_symbol" label="Binance Symbol">
            <Input placeholder="XRPUSDT" />
          </Form.Item>
          <Form.Item name="trading_notice" label="Trading Notice (shown to users)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="trading_enabled_at" label="Trading Enable At (schedule)">
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="trading_disabled_at" label="Trading Disable At (schedule)">
            <Input type="datetime-local" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="is_custom" label="Internal" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="pre_listing_mode" label="Pre-listing" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="show_countdown" label="Show Countdown" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" block>Update Pair</Button>
        </Form>
      </Modal>
    </div>
  );
}
