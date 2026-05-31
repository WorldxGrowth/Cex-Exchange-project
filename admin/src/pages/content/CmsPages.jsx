import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Form, Input,
         Select, Switch, message, Card, Popconfirm, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

export default function CmsPages() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getCmsPages();
      setPages(res.data || []);
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
      slug:           r.slug,
      title:          r.title,
      subtitle:       r.subtitle,
      icon:           r.icon,
      content:        r.content,
      content_type:   r.content_type,
      featured_image: r.featured_image,
      meta_title:     r.meta_title,
      meta_desc:      r.meta_desc,
      meta_keywords:  r.meta_keywords,
      page_type:      r.page_type,
      sort_order:     r.sort_order,
      is_published:   r.is_published,
      show_in_footer: r.show_in_footer,
      show_in_header: r.show_in_header,
    });
    setModal(true);
  };

  const handleSave = async (values) => {
    try {
      if (editRecord) {
        await adminAPI.updateCmsPage(editRecord.id, values);
        message.success('Page updated!');
      } else {
        await adminAPI.addCmsPage(values);
        message.success('Page created!');
      }
      setModal(false);
      fetch();
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    try {
      await adminAPI.deleteCmsPage(id);
      message.success('Deleted!');
      fetch();
    } catch (e) { message.error(e?.message || 'Cannot delete protected page'); }
  };

  const handleToggle = async (id, field, value) => {
    try {
      await adminAPI.updateCmsPage(id, { [field]: value });
      fetch();
    } catch (e) {}
  };

  const typeColors = {
    legal: 'red', info: 'blue', guide: 'green', custom: 'purple'
  };

  const columns = [
    { title: '#', dataIndex: 'sort_order', key: 'sort', width: 50 },
    { title: 'Icon', dataIndex: 'icon', key: 'icon', width: 50,
      render: v => <span style={{ fontSize: 20 }}>{v}</span> },
    { title: 'Title', key: 'title',
      render: (_, r) => (
        <div>
          <div style={{ color: '#fff', fontWeight: 600 }}>{r.title}</div>
          <code style={{ color: '#848e9c', fontSize: 11 }}>/{r.slug}</code>
        </div>
      )
    },
    { title: 'Type', dataIndex: 'page_type', key: 'type',
      render: v => <Tag color={typeColors[v] || 'default'}>{v}</Tag> },
    { title: 'Footer', dataIndex: 'show_in_footer', key: 'footer',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleToggle(r.id, 'show_in_footer', val)} /> },
    { title: 'Published', dataIndex: 'is_published', key: 'pub',
      render: (v, r) => <Switch size="small" checked={v}
        onChange={val => handleToggle(r.id, 'is_published', val)} /> },
    { title: 'Views', dataIndex: 'view_count', key: 'views',
      render: v => <Tag>{v || 0}</Tag> },
    { title: 'Actions', key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => window.open(`/pages/${r.slug}`, '_blank')} />
          <Button size="small" icon={<EditOutlined />}
            onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this page?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          📄 CMS Pages
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          New Page
        </Button>
      </div>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={pages} rowKey="id"
          loading={loading} pagination={false} scroll={{ x: 700 }} />
      </Card>

      <Modal
        title={editRecord ? `Edit: ${editRecord.title}` : 'New Page'}
        open={modal} onCancel={() => setModal(false)}
        footer={null} width={700}
      >
        <Form form={form} onFinish={handleSave} layout="vertical">
          {/* Basic Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
            <Form.Item name="icon" label="Icon (emoji)">
              <Input placeholder="📄" />
            </Form.Item>
            <Form.Item name="title" label="Title" rules={[{ required: true }]}>
              <Input placeholder="Privacy Policy" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="slug" label="Slug (URL)"
              rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: 'lowercase, numbers, hyphens only' }]}>
              <Input placeholder="privacy-policy" disabled={!!editRecord} />
            </Form.Item>
            <Form.Item name="page_type" label="Type" initialValue="info">
              <Select>
                <Select.Option value="legal">Legal</Select.Option>
                <Select.Option value="info">Info</Select.Option>
                <Select.Option value="guide">Guide</Select.Option>
                <Select.Option value="custom">Custom</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="subtitle" label="Subtitle">
            <Input placeholder="Brief description" />
          </Form.Item>

          <Form.Item name="content_type" label="Content Type" initialValue="html">
            <Select>
              <Select.Option value="html">HTML (rich content)</Select.Option>
              <Select.Option value="markdown">Markdown</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="content" label="Content (HTML supported — emoji ✅ images ✅ text ✅)">
            <Input.TextArea
              rows={10}
              placeholder="<h2>Privacy Policy</h2><p>Your content here...</p>"
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Item>

          <Form.Item name="featured_image" label="Featured Image URL">
            <Input placeholder="https://cdn.example.com/image.jpg" />
          </Form.Item>

          {/* SEO */}
          <Card size="small" style={{ background: '#2b2f36', marginBottom: 12 }}
            title={<span style={{ color: '#848e9c', fontSize: 12 }}>SEO Settings</span>}>
            <Form.Item name="meta_title" label="Meta Title">
              <Input placeholder="Privacy Policy | VDExchange" />
            </Form.Item>
            <Form.Item name="meta_desc" label="Meta Description">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="meta_keywords" label="Meta Keywords">
              <Input placeholder="exchange, trading, privacy" />
            </Form.Item>
          </Card>

          {/* Settings */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Form.Item name="is_published" label="Published" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
            <Form.Item name="show_in_footer" label="Show in Footer" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
            <Form.Item name="show_in_header" label="Show in Header" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
          </div>

          <Button type="primary" htmlType="submit" block>
            {editRecord ? 'Update Page' : 'Create Page'}
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
