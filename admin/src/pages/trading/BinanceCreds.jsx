import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Form,
         Switch, message, Card, InputNumber, Input } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function BinanceCreds() {
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getBinanceCreds();
      setCreds(res.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openEdit = (r) => {
    setEditRecord(r);
    form.setFieldsValue({
      label:               r.label,
      is_active:           r.is_active,
      trading_enabled:     r.trading_enabled,
      max_order_value:     parseFloat(r.max_order_value),
      daily_exposure_limit: parseFloat(r.daily_exposure_limit),
    });
    setModal(true);
  };

  const handleSave = async (values) => {
    try {
      await adminAPI.updateBinanceCred(editRecord.id, values);
      message.success('Updated!');
      setModal(false);
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const columns = [
    { title: 'Label', dataIndex: 'label', key: 'label' },
    { title: 'API Key', dataIndex: 'api_key_preview', key: 'key',
      render: v => <Tag color="blue">{v}...</Tag> },
    { title: 'Active', dataIndex: 'is_active', key: 'active',
      render: v => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag> },
    { title: 'Trading', dataIndex: 'trading_enabled', key: 'trading',
      render: v => <Tag color={v ? 'green' : 'orange'}>{v ? 'Enabled' : 'Disabled'}</Tag> },
    { title: 'Max Order', dataIndex: 'max_order_value', key: 'max',
      render: v => `$${v}` },
    { title: 'Daily Limit', dataIndex: 'daily_exposure_limit', key: 'daily',
      render: v => `$${v}` },
    { title: 'Edit', key: 'edit',
      render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /> },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: '#fff', marginBottom: 16 }}>
        🔑 Binance Credentials
      </Typography.Title>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={creds} rowKey="id"
          loading={loading} pagination={false} />
      </Card>

      <Modal title="Edit Binance Credential" open={modal}
        onCancel={() => setModal(false)} footer={null}>
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item name="label" label="Label">
            <Input />
          </Form.Item>
          <Form.Item name="max_order_value" label="Max Order Value ($)">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="daily_exposure_limit" label="Daily Exposure Limit ($)">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 24 }}>
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="trading_enabled" label="Trading Enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" block>Update</Button>
        </Form>
      </Modal>
    </div>
  );
}
