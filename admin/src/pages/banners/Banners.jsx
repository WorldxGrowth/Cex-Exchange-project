import { useEffect, useState } from 'react';
import { Card, Button, Table, Tag, Typography, Modal,
         Form, Input, Select, Switch, message, Image, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

const { Text } = Typography;

export default function Banners() {
  const [banners, setBanners] = useState([]);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminAPI.getBanners().then(res => setBanners(res.data || [])).catch(() => {});
  }, []);

  const handleAdd = async (values) => {
    setLoading(true);
    try {
      await adminAPI.addBanner(values);
      message.success('Banner added!');
      setModal(false);
      form.resetFields();
      adminAPI.getBanners().then(res => setBanners(res.data || []));
    } catch { message.error('Failed'); }
    finally { setLoading(false); }
  };

  const columns = [
    { title: 'Preview', dataIndex: 'image_url', key: 'img',
      render: v => v ? <Image src={v} height={50} style={{ borderRadius: 4 }} /> : '-' },
    { title: 'Title', dataIndex: 'title', key: 'title',
      render: v => <Text style={{ color: '#fff' }}>{v}</Text> },
    { title: 'Position', dataIndex: 'position', key: 'pos',
      render: v => <Tag>{v}</Tag> },
    { title: 'Platform', dataIndex: 'platform', key: 'plat',
      render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Status', dataIndex: 'is_active', key: 'active',
      render: v => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag> },
    { title: 'Actions', key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />}>Edit</Button>
          <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
        </Space>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    marginBottom: 16, alignItems: 'center' }}>
        <Text strong style={{ color: '#fff', fontSize: 18 }}>🖼️ Banner Management</Text>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => setModal(true)}>Add Banner</Button>
      </div>

      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
        <Table dataSource={banners} columns={columns} rowKey="id"
          pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title={<Text style={{ color: '#fff' }}>Add Banner</Text>}
        open={modal} onCancel={() => setModal(false)}
        onOk={() => form.submit()} confirmLoading={loading}>
        <Form form={form} onFinish={handleAdd} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Banner title" />
          </Form.Item>
          <Form.Item name="image_url" label="Image URL" rules={[{ required: true }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="link_url" label="Link URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="position" label="Position" initialValue="home_top">
            <Select>
              <Select.Option value="home_top">Home Top (Slider)</Select.Option>
              <Select.Option value="home_middle">Home Middle</Select.Option>
              <Select.Option value="markets_top">Markets Top</Select.Option>
              <Select.Option value="popup">Popup</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="platform" label="Platform" initialValue="all">
            <Select>
              <Select.Option value="all">All</Select.Option>
              <Select.Option value="mobile">Mobile</Select.Option>
              <Select.Option value="desktop">Desktop</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
