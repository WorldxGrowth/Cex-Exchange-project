import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Form,
         Switch, message, Card, InputNumber } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function WithdrawalSettings() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getWithdrawalSettings();
      setSettings(res.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openEdit = (r) => {
    setEditRecord(r);
    form.setFieldsValue({
      min_amount:        parseFloat(r.min_amount),
      max_amount:        parseFloat(r.max_amount),
      fee_fixed:         parseFloat(r.fee_fixed),
      fee_percent:       parseFloat(r.fee_percent),
      auto_approve_limit: parseFloat(r.auto_approve_limit),
      low_balance_alert: parseFloat(r.low_balance_alert),
      is_enabled:        r.is_enabled,
    });
    setModal(true);
  };

  const handleSave = async (values) => {
    try {
      await adminAPI.updateWithdrawalSetting(editRecord.id, values);
      message.success('Updated!');
      setModal(false);
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const columns = [
    { title: 'Coin', dataIndex: 'symbol', key: 'sym',
      render: v => <Tag color="blue" style={{ fontWeight: 700 }}>{v}</Tag> },
    { title: 'Min', dataIndex: 'min_amount', key: 'min',
      render: v => parseFloat(v).toFixed(2) },
    { title: 'Max', dataIndex: 'max_amount', key: 'max',
      render: v => parseFloat(v).toLocaleString() },
    { title: 'Fixed Fee', dataIndex: 'fee_fixed', key: 'fee',
      render: v => <Tag color="orange">{parseFloat(v)}</Tag> },
    { title: '% Fee', dataIndex: 'fee_percent', key: 'feep',
      render: v => `${parseFloat(v)}%` },
    { title: 'Auto Approve ≤', dataIndex: 'auto_approve_limit', key: 'auto',
      render: v => <Tag color="green">${parseFloat(v)}</Tag> },
    { title: 'Enabled', dataIndex: 'is_enabled', key: 'en',
      render: v => <Tag color={v ? 'green' : 'red'}>{v ? 'Yes' : 'No'}</Tag> },
    { title: 'Edit', key: 'edit',
      render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /> },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: '#fff', marginBottom: 16 }}>
        💸 Withdrawal Settings
      </Typography.Title>
      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={settings} rowKey="id"
          loading={loading} pagination={false} scroll={{ x: 700 }} />
      </Card>

      <Modal title={`Edit: ${editRecord?.symbol}`} open={modal}
        onCancel={() => setModal(false)} footer={null}>
        <Form form={form} onFinish={handleSave} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="min_amount" label="Min Amount">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="max_amount" label="Max Amount">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="fee_fixed" label="Fixed Fee">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="fee_percent" label="% Fee">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="auto_approve_limit" label="Auto Approve Limit ($)">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="low_balance_alert" label="Low Balance Alert">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="is_enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Update</Button>
        </Form>
      </Modal>
    </div>
  );
}
