import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Form, Input, Select, Space, message, Card, Switch } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function Coins() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getCoins();
      setCoins(res.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = async (values) => {
    try {
      await adminAPI.addCoin(values);
      message.success('Coin added!');
      setModal(false);
      form.resetFields();
      fetch();
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  const handleToggle = async (id, field, value) => {
    try {
      await adminAPI.updateCoin(id, { [field]: value });
      message.success('Updated!');
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const columns = [
    { title: 'Symbol', dataIndex: 'symbol', key: 'sym', render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Name',   dataIndex: 'name',   key: 'name' },
    { title: 'Network',dataIndex: 'network_name', key: 'net' },
    { title: 'Price',  dataIndex: 'price_usdt', key: 'price', render: v => v ? `$${parseFloat(v).toFixed(4)}` : '-' },
    { title: 'Deposit', dataIndex: 'is_deposit', key: 'dep', render: (v, r) => <Switch size="small" checked={v} onChange={val => handleToggle(r.id, 'is_deposit', val)} /> },
    { title: 'Withdraw',dataIndex: 'is_withdraw', key: 'wd', render: (v, r) => <Switch size="small" checked={v} onChange={val => handleToggle(r.id, 'is_withdraw', val)} /> },
    { title: 'Active',  dataIndex: 'is_active', key: 'act', render: (v, r) => <Switch size="small" checked={v} onChange={val => handleToggle(r.id, 'is_active', val)} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>💰 Coins Management</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>Add Coin</Button>
      </div>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={coins} rowKey="id" loading={loading} />
      </Card>

      <Modal title="Add New Coin" open={modal} onCancel={() => setModal(false)} footer={null} width={500}>
        <Form form={form} onFinish={handleAdd} layout="vertical">
          <Form.Item name="symbol" label="Symbol" rules={[{ required: true }]}><Input placeholder="BTC" /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input placeholder="Bitcoin" /></Form.Item>
          <Form.Item name="network_id" label="Network" rules={[{ required: true }]}>
            <Select placeholder="Select network">
              <Select.Option value={1}>BSC</Select.Option>
              <Select.Option value={2}>ETH</Select.Option>
              <Select.Option value={3}>TRX</Select.Option>
              <Select.Option value={4}>VDChain</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="price_source" label="Price Source" initialValue="binance">
            <Select>
              <Select.Option value="binance">Binance</Select.Option>
              <Select.Option value="coingecko">CoinGecko</Select.Option>
              <Select.Option value="custom">Custom</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="price_symbol" label="Price Symbol"><Input placeholder="BTCUSDT" /></Form.Item>
          <Form.Item name="contract_address" label="Contract Address"><Input placeholder="0x..." /></Form.Item>
          <Button type="primary" htmlType="submit" block>Add Coin</Button>
        </Form>
      </Modal>
    </div>
  );
}
