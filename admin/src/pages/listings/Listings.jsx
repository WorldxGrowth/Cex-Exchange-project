import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Input, Space, message, Card, Descriptions } from 'antd';
import { adminAPI } from '../../services/api';

export default function Listings() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, record: null, action: '' });
  const [note, setNote] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getListings({ status: 'pending' });
      setData(res.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleProcess = async () => {
    try {
      await adminAPI.processListing(modal.record.id, { action: modal.action, admin_notes: note });
      message.success(`Listing ${modal.action}d!`);
      setModal({ open: false, record: null, action: '' });
      fetch();
    } catch (e) { message.error('Failed: ' + (e?.message || '')); }
  };

  const statusColor = { pending: 'orange', approved: 'green', rejected: 'red', live: 'blue' };

  const columns = [
    { title: 'Token', dataIndex: 'token_symbol', key: 'sym', render: (v, r) => <><strong style={{ color: '#1890ff' }}>{v}</strong><br/><small>{r.token_name}</small></> },
    { title: 'Package', dataIndex: 'listing_package', key: 'pkg', render: v => <Tag color="purple">{v}</Tag> },
    { title: 'Fee', dataIndex: 'listing_fee', key: 'fee', render: v => `₹${parseInt(v).toLocaleString()}` },
    { title: 'Applicant', dataIndex: 'email', key: 'email' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: v => <Tag color={statusColor[v]}>{v}</Tag> },
    { title: 'Date', dataIndex: 'created_at', key: 'date', render: v => new Date(v).toLocaleDateString() },
    {
      title: 'Actions', key: 'actions',
      render: (_, r) => r.status === 'pending' ? (
        <Space>
          <Button size="small" type="primary" onClick={() => { setModal({ open: true, record: r, action: 'approve' }); setNote(''); }}>Approve</Button>
          <Button size="small" danger onClick={() => { setModal({ open: true, record: r, action: 'reject' }); setNote(''); }}>Reject</Button>
        </Space>
      ) : <Tag color={statusColor[r.status]}>{r.status}</Tag>
    }
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: '#fff', marginBottom: 16 }}>
        🚀 Token Listing Applications
      </Typography.Title>
      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={`${modal.action === 'approve' ? '✅ Approve' : '❌ Reject'} Token Listing`}
        open={modal.open} onOk={handleProcess}
        onCancel={() => setModal({ open: false, record: null, action: '' })}
        width={600}
      >
        {modal.record && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Token">{modal.record.token_symbol} - {modal.record.token_name}</Descriptions.Item>
              <Descriptions.Item label="Package">{modal.record.listing_package}</Descriptions.Item>
              <Descriptions.Item label="Fee">₹{parseInt(modal.record.listing_fee).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Initial Price">${modal.record.initial_price || 'Not set'}</Descriptions.Item>
              <Descriptions.Item label="Contract">{modal.record.contract_address || 'Not provided'}</Descriptions.Item>
            </Descriptions>
            <Input.TextArea placeholder="Admin notes..." value={note} onChange={e => setNote(e.target.value)} rows={3} />
          </Space>
        )}
      </Modal>
    </div>
  );
}
