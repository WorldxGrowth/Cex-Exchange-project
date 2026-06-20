import { useEffect, useState } from 'react';
import {
  Tabs, Card, Switch, InputNumber, Input, Button, Typography,
  message, Tooltip, Space, Modal, Form, Select, Row, Col, Empty
} from 'antd';
import {
  QuestionCircleOutlined, PlusOutlined, SaveOutlined,
  SettingOutlined, DollarOutlined, ThunderboltOutlined,
  SafetyCertificateOutlined, ShareAltOutlined, MailOutlined,
  MessageOutlined, GiftOutlined, RiseOutlined, UploadOutlined
} from '@ant-design/icons';
import { Upload } from 'antd';
import { adminAPI } from '../../services/api';

// Keys that represent an image/logo - these get an upload button + preview
const IMAGE_KEYS = ['site_logo', 'site_logo_circle', 'site_logo_rectangle', 'site_favicon', 'og_image'];

// Category metadata - icon + display order + friendly label
const CATEGORY_META = {
  general:  { icon: <SettingOutlined />,            label: 'General & Branding' },
  finance:  { icon: <DollarOutlined />,              label: 'Finance' },
  trading:  { icon: <RiseOutlined />,                 label: 'Trading' },
  futures:  { icon: <ThunderboltOutlined />,          label: 'Futures' },
  kyc:      { icon: <SafetyCertificateOutlined />,    label: 'KYC' },
  bonus:    { icon: <GiftOutlined />,                  label: 'Bonus & Rewards' },
  referral: { icon: <ShareAltOutlined />,              label: 'Referral' },
  contact:  { icon: <MailOutlined />,                  label: 'Contact' },
  social:   { icon: <ShareAltOutlined />,              label: 'Social' },
  sms:      { icon: <MessageOutlined />,               label: 'SMS / OTP' },
};
const CATEGORY_ORDER = ['general','finance','trading','futures','kyc','bonus','referral','contact','social','sms'];

export default function Settings() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState({});   // { key: newValue } - unsaved edits
  const [saving, setSaving] = useState({}); // { key: true } - currently saving
  const [addModal, setAddModal] = useState(false);
  const [addForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getSettings();
      setSettings(res.data || []);
    } catch (e) { message.error('Failed to load settings'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = settings.reduce((acc, s) => {
    const cat = s.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const orderedCategories = [
    ...CATEGORY_ORDER.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)), // any new/unknown category still shows up
  ];

  const handleSave = async (key) => {
    const value = dirty[key];
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await adminAPI.updateSetting(key, { value: String(value) });
      message.success('Saved!');
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value: String(value) } : s));
      setDirty(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch (e) { message.error('Failed to save'); }
    setSaving(prev => ({ ...prev, [key]: false }));
  };

  // Boolean toggles save IMMEDIATELY on change (no separate save click needed - matches
  // the instant-toggle pattern already used on the Coins page for consistency)
  const handleToggleSave = async (key, value) => {
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await adminAPI.updateSetting(key, { value: String(value) });
      message.success('Updated!');
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value: String(value) } : s));
    } catch (e) { message.error('Failed to update'); }
    setSaving(prev => ({ ...prev, [key]: false }));
  };

  const handleAddSetting = async (values) => {
    try {
      await adminAPI.addSetting(values);
      message.success('Setting created!');
      setAddModal(false);
      addForm.resetFields();
      load();
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  // ── Image upload for logo/branding fields ──
  const handleImageUpload = async (file, key) => {
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await adminAPI.uploadImage(formData);
      const url = res.data.url;
      await adminAPI.updateSetting(key, { value: url });
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value: url } : s));
      setDirty(prev => { const n = { ...prev }; delete n[key]; return n; });
      message.success('Image uploaded and saved!');
    } catch (e) { message.error(e?.message || 'Upload failed'); }
    setSaving(prev => ({ ...prev, [key]: false }));
    return false; // prevent antd Upload's default auto-submit behavior
  };

  // ── Renders the correct input type based on setting.type ──
  const renderInput = (s) => {
    const currentValue = dirty[s.key] !== undefined ? dirty[s.key] : s.value;
    const isSaving = !!saving[s.key];

    if (s.type === 'boolean') {
      return (
        <Switch
          checked={currentValue === 'true' || currentValue === true}
          loading={isSaving}
          onChange={(val) => handleToggleSave(s.key, val)}
        />
      );
    }

    if (s.type === 'number') {
      return (
        <Space.Compact style={{ width: '100%', maxWidth: 280 }}>
          <InputNumber
            style={{ width: '100%' }}
            value={currentValue}
            onChange={(val) => setDirty(prev => ({ ...prev, [s.key]: val }))}
          />
          {dirty[s.key] !== undefined && (
            <Button type="primary" icon={<SaveOutlined />} loading={isSaving}
              onClick={() => handleSave(s.key)} />
          )}
        </Space.Compact>
      );
    }

    // Image/logo fields: preview + URL input + upload button
    if (IMAGE_KEYS.includes(s.key)) {
      return (
        <div>
          {currentValue && (
            <div style={{ marginBottom: 8, background: '#fff', borderRadius: 8, padding: 6,
                          display: 'inline-block' }}>
              <img src={currentValue} alt={s.key}
                style={{ maxHeight: 48, maxWidth: 120, display: 'block' }}
                onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          )}
          <Space.Compact style={{ width: '100%', maxWidth: 420 }}>
            <Input
              placeholder="Paste image URL or upload below"
              value={currentValue}
              onChange={(e) => setDirty(prev => ({ ...prev, [s.key]: e.target.value }))}
            />
            {dirty[s.key] !== undefined && (
              <Button type="primary" icon={<SaveOutlined />} loading={isSaving}
                onClick={() => handleSave(s.key)} />
            )}
          </Space.Compact>
          <Upload
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/x-icon,image/webp"
            showUploadList={false}
            beforeUpload={(file) => handleImageUpload(file, s.key)}
          >
            <Button icon={<UploadOutlined />} size="small" loading={isSaving}
              style={{ marginTop: 8 }}>
              Upload from device
            </Button>
          </Upload>
        </div>
      );
    }

    // default: string/text
    return (
      <Space.Compact style={{ width: '100%', maxWidth: 420 }}>
        <Input
          value={currentValue}
          onChange={(e) => setDirty(prev => ({ ...prev, [s.key]: e.target.value }))}
        />
        {dirty[s.key] !== undefined && (
          <Button type="primary" icon={<SaveOutlined />} loading={isSaving}
            onClick={() => handleSave(s.key)} />
        )}
      </Space.Compact>
    );
  };

  const renderCategoryContent = (category) => {
    const items = grouped[category] || [];
    if (items.length === 0) return <Empty description="No settings in this category" />;

    return (
      <Row gutter={[16, 16]}>
        {items.map(s => (
          <Col key={s.key} xs={24} md={12} lg={8}>
            <Card size="small" style={{ background: '#1f1f1f', border: '1px solid #303030', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Typography.Text strong style={{ color: '#fff', fontSize: 13 }}>
                  {s.label || s.key}
                </Typography.Text>
                {s.description && (
                  <Tooltip title={s.description}>
                    <QuestionCircleOutlined style={{ color: '#888', fontSize: 13 }} />
                  </Tooltip>
                )}
              </div>
              {renderInput(s)}
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 11 }}>
                <code>{s.key}</code>
              </Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  const tabItems = orderedCategories.map(cat => ({
    key: cat,
    label: (
      <span>
        {CATEGORY_META[cat]?.icon || <SettingOutlined />}{' '}
        {CATEGORY_META[cat]?.label || cat.charAt(0).toUpperCase() + cat.slice(1)}
      </span>
    ),
    children: renderCategoryContent(cat),
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          ⚙️ System Settings
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModal(true)}>
          Add New Setting
        </Button>
      </div>

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Changes to toggles save instantly. For text/number fields, click the save icon after editing.
        Any new setting added here (or directly in the database) appears automatically — no code changes needed.
      </Typography.Text>

      <Card style={{ background: '#161616', border: '1px solid #303030', borderRadius: 12 }} loading={loading}>
        <Tabs items={tabItems} tabPosition="left" />
      </Card>

      {/* Add New Setting Modal */}
      <Modal title="Add New Setting" open={addModal}
        onCancel={() => setAddModal(false)} footer={null} width={500}>
        <Form form={addForm} onFinish={handleAddSetting} layout="vertical">
          <Form.Item name="key" label="Key (unique identifier)" rules={[{ required: true }]}>
            <Input placeholder="e.g. new_feature_enabled" />
          </Form.Item>
          <Form.Item name="label" label="Display Label" rules={[{ required: true }]}>
            <Input placeholder="e.g. New Feature Enabled" />
          </Form.Item>
          <Form.Item name="description" label="Description (shown as tooltip)">
            <Input.TextArea rows={2} placeholder="Explain what this setting controls..." />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]} initialValue="general">
            <Select>
              {CATEGORY_ORDER.map(c => (
                <Select.Option key={c} value={c}>{CATEGORY_META[c]?.label || c}</Select.Option>
              ))}
              <Select.Option value="other">Other (new category)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]} initialValue="string">
            <Select>
              <Select.Option value="string">Text</Select.Option>
              <Select.Option value="number">Number</Select.Option>
              <Select.Option value="boolean">Toggle (On/Off)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="value" label="Initial Value" rules={[{ required: true }]}>
            <Input placeholder="true / false / 0 / text..." />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Create Setting</Button>
        </Form>
      </Modal>
    </div>
  );
}
