import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Form, Input,
         Select, Switch, message, Card, InputNumber, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function FeeRules() {
  const [rules, setRules] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const [rulesRes, pairsRes] = await Promise.all([
        adminAPI.getFeeRules(), adminAPI.getPairs()
      ]);
      setRules(rulesRes.data || []);
      setPairs(pairsRes.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openAdd = () => {
    setEditRecord(null);
    form.resetFields();
    setModal(true);
  };

  const openEdit = (r) => {
    setEditRecord(r);
    form.setFieldsValue({
      rule_type: r.rule_type, pair_id: r.pair_id,
      vip_level: r.vip_level, fee_type: r.fee_type,
      fee_value: parseFloat(r.fee_value), priority: r.priority,
      title: r.title, is_active: r.is_active,
      starts_at: r.starts_at?.slice(0,16),
      ends_at: r.ends_at?.slice(0,16),
    });
    setModal(true);
  };

  const handleSave = async (values) => {
    try {
      if (editRecord) {
        await adminAPI.updateFeeRule(editRecord.id, values);
        message.success('Updated!');
      } else {
        await adminAPI.addFeeRule(values);
        message.success('Rule added!');
      }
      setModal(false);
      fetch();
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    try {
      await adminAPI.deleteFeeRule(id);
      message.success('Deleted!');
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const columns = [
    { title: 'Rule Type', dataIndex: 'rule_type', key: 'type',
      render: v => <Tag color={v.includes('maker') ? 'blue' : 'orange'}>{v}</Tag> },
    { title: 'Pair', dataIndex: 'pair_symbol', key: 'pair',
      render: v => v ? <Tag color="purple">{v}</Tag> : <Tag>All</Tag> },
    { title: 'VIP', dataIndex: 'vip_level', key: 'vip',
      render: v => <Tag color="gold">VIP {v}</Tag> },
    { title: 'Fee', key: 'fee',
      render: (_, r) => <Tag color="green">
        {r.fee_type === 'percentage'
          ? `${(parseFloat(r.fee_value)*100).toFixed(3)}%`
          : r.fee_value}
      </Tag> },
    { title: 'Priority', dataIndex: 'priority', key: 'pri' },
    { title: 'Campaign', key: 'campaign',
      render: (_, r) => r.starts_at
        ? <Tag color="magenta">{r.title || 'Campaign'}</Tag>
        : <Tag>Default</Tag> },
    { title: 'Active', dataIndex: 'is_active', key: 'act',
      render: v => <Tag color={v ? 'green' : 'red'}>{v ? 'Yes' : 'No'}</Tag> },
    { title: 'Actions', key: 'actions',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this rule?" onConfirm={() => handleDelete(r.id)}
            okText="Yes" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          💱 Fee Rules
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          Add Rule
        </Button>
      </div>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={rules} rowKey="id"
          loading={loading} scroll={{ x: 800 }} />
      </Card>

      <Modal title={editRecord ? 'Edit Fee Rule' : 'Add Fee Rule'}
        open={modal} onCancel={() => setModal(false)} footer={null} width={500}>
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item name="rule_type" label="Rule Type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="spot_maker">Spot Maker</Select.Option>
              <Select.Option value="spot_taker">Spot Taker</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="pair_id" label="Pair (empty = all pairs)">
            <Select allowClear showSearch>
              {pairs.map(p => <Select.Option key={p.id} value={p.id}>{p.symbol}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="vip_level" label="VIP Level" initialValue={0}>
            <Select>
              {[0,1,2,3,4,5].map(v => <Select.Option key={v} value={v}>VIP {v}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="fee_value" label="Fee Value" rules={[{ required: true }]}>
            <InputNumber step={0.0001} precision={6} style={{ width: '100%' }}
              placeholder="0.001 = 0.1%" />
          </Form.Item>
          <Form.Item name="priority" label="Priority (lower = higher priority)" initialValue={100}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="title" label="Title (for campaign)">
            <Input placeholder="Zero fee campaign" />
          </Form.Item>
          <Form.Item name="starts_at" label="Campaign Start (optional)">
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="ends_at" label="Campaign End (optional)">
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            {editRecord ? 'Update Rule' : 'Add Rule'}
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
