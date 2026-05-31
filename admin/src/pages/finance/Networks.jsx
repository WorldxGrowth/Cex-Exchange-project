import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Form,
         Input, Switch, message, Card } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function Networks() {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getNetworks();
      setNetworks(res.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openEdit = (r) => {
    setEditRecord(r);
    form.setFieldsValue({
      name:         r.name,
      rpc_url:      r.rpc_url,
      explorer_url: r.explorer_url,
      is_active:    r.is_active,
    });
    setModal(true);
  };

  const handleSave = async (values) => {
    try {
      await adminAPI.updateNetwork(editRecord.id, values);
      message.success('Network updated!');
      setModal(false);
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name',
      render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Short', dataIndex: 'short_name', key: 'short' },
    { title: 'Chain ID', dataIndex: 'chain_id', key: 'chain' },
    { title: 'RPC URL', dataIndex: 'rpc_url', key: 'rpc',
      render: v => <code style={{ color: '#1890ff', fontSize: 11 }}>
        {v?.slice(0, 40)}{v?.length > 40 ? '...' : ''}
      </code> },
    { title: 'Active', dataIndex: 'is_active', key: 'act',
      render: v => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag> },
    { title: 'Edit', key: 'edit',
      render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /> },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: '#fff', marginBottom: 16 }}>
        🌐 Networks
      </Typography.Title>
      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={networks} rowKey="id"
          loading={loading} pagination={false} />
      </Card>

      <Modal title={`Edit: ${editRecord?.name}`} open={modal}
        onCancel={() => setModal(false)} footer={null}>
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item name="name" label="Name"><Input /></Form.Item>
          <Form.Item name="rpc_url" label="RPC URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="explorer_url" label="Explorer URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Update Network</Button>
        </Form>
      </Modal>
    </div>
  );
}
