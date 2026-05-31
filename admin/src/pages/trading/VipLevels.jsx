import { useEffect, useState } from 'react';
import { Table, Button, Typography, Modal, Form,
         message, Card, InputNumber, Tag } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function VipLevels() {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getVipLevels();
      setLevels(res.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openEdit = (r) => {
    setEditRecord(r);
    form.setFieldsValue({
      spot_maker_fee:      parseFloat(r.spot_maker_fee),
      spot_taker_fee:      parseFloat(r.spot_taker_fee),
      required_volume_30d: parseFloat(r.required_volume_30d),
      withdraw_limit_daily: parseFloat(r.withdraw_limit_daily),
    });
    setModal(true);
  };

  const handleSave = async (values) => {
    try {
      await adminAPI.updateVipLevel(editRecord.level, values);
      message.success('VIP level updated!');
      setModal(false);
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const columns = [
    { title: 'Level', dataIndex: 'level', key: 'lvl',
      render: v => <Tag color="gold" style={{ fontWeight: 700 }}>VIP {v}</Tag> },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Volume Required (30D)', dataIndex: 'required_volume_30d', key: 'vol',
      render: v => `$${parseFloat(v).toLocaleString()}` },
    { title: 'Maker Fee', dataIndex: 'spot_maker_fee', key: 'maker',
      render: v => <Tag color="blue">{(parseFloat(v)*100).toFixed(2)}%</Tag> },
    { title: 'Taker Fee', dataIndex: 'spot_taker_fee', key: 'taker',
      render: v => <Tag color="orange">{(parseFloat(v)*100).toFixed(2)}%</Tag> },
    { title: 'Withdraw Limit/Day', dataIndex: 'withdraw_limit_daily', key: 'wd',
      render: v => `$${parseFloat(v).toLocaleString()}` },
    { title: 'Edit', key: 'edit',
      render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /> },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: '#fff', marginBottom: 16 }}>
        🏆 VIP Levels
      </Typography.Title>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={levels} rowKey="level"
          loading={loading} pagination={false} />
      </Card>

      <Modal title={`Edit VIP ${editRecord?.level} - ${editRecord?.name}`}
        open={modal} onCancel={() => setModal(false)} footer={null}>
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item name="required_volume_30d" label="Required Volume 30D ($)">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="spot_maker_fee" label="Spot Maker Fee (e.g. 0.001 = 0.1%)">
            <InputNumber step={0.0001} precision={6} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="spot_taker_fee" label="Spot Taker Fee">
            <InputNumber step={0.0001} precision={6} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="withdraw_limit_daily" label="Daily Withdraw Limit ($)">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Update VIP Level</Button>
        </Form>
      </Modal>
    </div>
  );
}
