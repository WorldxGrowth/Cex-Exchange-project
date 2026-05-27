import { useEffect, useState } from 'react';
import { Table, Button, Input, Typography, message, Card, Tag, Space } from 'antd';
import { adminAPI } from '../../services/api';

export default function Settings() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});

  useEffect(() => {
    adminAPI.getSettings().then(res => {
      setSettings(res.data);
      setLoading(false);
    });
  }, []);

  const handleUpdate = async (key, value) => {
    try {
      await adminAPI.updateSetting(key, { value });
      message.success('Setting updated!');
      setEditing(prev => ({ ...prev, [key]: undefined }));
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    } catch (e) { message.error('Failed'); }
  };

  const categoryColors = { general: 'blue', finance: 'green', trading: 'orange', kyc: 'purple', contact: 'cyan', social: 'pink' };

  const columns = [
    { title: 'Key', dataIndex: 'key', key: 'key', render: v => <code style={{ color: '#1890ff' }}>{v}</code>, width: 220 },
    { title: 'Category', dataIndex: 'category', key: 'cat', width: 100, render: v => <Tag color={categoryColors[v] || 'default'}>{v}</Tag> },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 80, render: v => <Tag>{v}</Tag> },
    {
      title: 'Value', dataIndex: 'value', key: 'value',
      render: (v, r) => editing[r.key] !== undefined ? (
        <Space>
          <Input
            value={editing[r.key]}
            onChange={e => setEditing(prev => ({ ...prev, [r.key]: e.target.value }))}
            style={{ width: 200 }}
            size="small"
          />
          <Button size="small" type="primary" onClick={() => handleUpdate(r.key, editing[r.key])}>Save</Button>
          <Button size="small" onClick={() => setEditing(prev => ({ ...prev, [r.key]: undefined }))}>Cancel</Button>
        </Space>
      ) : (
        <Space>
          <span style={{ color: '#fff' }}>{v}</span>
          <Button size="small" onClick={() => setEditing(prev => ({ ...prev, [r.key]: v }))}>Edit</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: '#fff', marginBottom: 16 }}>
        ⚙️ System Settings
      </Typography.Title>
      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={settings} rowKey="key" loading={loading} pagination={false} />
      </Card>
    </div>
  );
}
