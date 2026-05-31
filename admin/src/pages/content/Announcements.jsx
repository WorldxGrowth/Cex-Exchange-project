import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Form,
         Input, Select, Switch, message, Card, Popconfirm, Avatar } from 'antd';
import { PlusOutlined, DeleteOutlined, PictureOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function Announcements() {
  const [anns, setAnns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getAnnouncements();
      setAnns(res.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = async (values) => {
    try {
      await adminAPI.addAnnouncement(values);
      message.success('Published!');
      setModal(false);
      form.resetFields();
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const handleDelete = async (id) => {
    try {
      await adminAPI.deleteAnnouncement(id);
      message.success('Deleted!');
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const handleToggle = async (id, is_published) => {
    try {
      await adminAPI.updateAnnouncement(id, { is_published });
      fetch();
    } catch (e) {}
  };

  const typeColors = {
    system: 'blue', promo: 'gold',
    listing: 'green', maintenance: 'red'
  };

  const columns = [
    { title: 'Thumbnail', key: 'thumb', width: 60,
      render: (_, r) => r.image_url
        ? <Avatar src={r.image_url} size={36} shape="square" />
        : <Avatar icon={<PictureOutlined />} size={36} shape="square"
            style={{ background: '#2b2f36' }} /> },
    { title: 'Title', dataIndex: 'title', key: 'title',
      render: v => <span style={{ color: '#fff', fontWeight: 600 }}>{v}</span> },
    { title: 'Type', dataIndex: 'type', key: 'type',
      render: v => <Tag color={typeColors[v] || 'default'}>{v}</Tag> },
    { title: 'Published', dataIndex: 'is_published', key: 'pub',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleToggle(r.id, val)} /> },
    { title: 'Expires', dataIndex: 'expires_at', key: 'exp',
      render: v => v ? new Date(v).toLocaleDateString() : <Tag>Never</Tag> },
    { title: 'Date', dataIndex: 'created_at', key: 'date',
      render: v => new Date(v).toLocaleDateString() },
    { title: '', key: 'del',
      render: (_, r) => (
        <Popconfirm title="Delete?" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          📢 Announcements
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>
          New
        </Button>
      </div>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={anns} rowKey="id"
          loading={loading} scroll={{ x: 700 }} />
      </Card>

      <Modal title="New Announcement" open={modal}
        onCancel={() => setModal(false)} footer={null} width={520}>
        <Form form={form} onFinish={handleAdd} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="System maintenance scheduled" />
          </Form.Item>
          <Form.Item name="image_url" label="Thumbnail URL (optional)">
            <Input placeholder="https://cdn.example.com/image.jpg" />
          </Form.Item>
          <Form.Item name="content" label="Content" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="type" label="Type" initialValue="system">
            <Select>
              <Select.Option value="system">System</Select.Option>
              <Select.Option value="promo">Promotion</Select.Option>
              <Select.Option value="listing">New Listing</Select.Option>
              <Select.Option value="maintenance">Maintenance</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="expires_at" label="Expires At">
            <Input type="datetime-local" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Publish</Button>
        </Form>
      </Modal>
    </div>
  );
}
