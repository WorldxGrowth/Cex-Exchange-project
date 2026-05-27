import { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Modal, Input, Space, message, Card } from 'antd';
import { adminAPI } from '../../services/api';

export default function Withdrawals() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, record: null, action: '' });
  const [txhash, setTxhash] = useState('');
  const [note, setNote] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getPendingWithdrawals();
      setData(res.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleProcess = async () => {
    try {
      await adminAPI.processWithdrawal(modal.record.id, {
        action: modal.action, txhash, admin_note: note
      });
      message.success(`Withdrawal ${modal.action}d`);
      setModal({ open: false, record: null, action: '' });
      fetch();
    } catch (e) { message.error('Failed'); }
  };

  const columns = [
    { title: 'User',    dataIndex: 'email',  key: 'email' },
    { title: 'Coin',    dataIndex: 'symbol', key: 'coin', render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Amount',  dataIndex: 'amount', key: 'amount', render: (v, r) => `${parseFloat(v).toFixed(6)} ${r.symbol}` },
    { title: 'Network', dataIndex: 'network_name', key: 'network' },
    { title: 'Address', dataIndex: 'to_address', key: 'addr', render: v => <code style={{ fontSize: 11, color: '#1890ff' }}>{v?.slice(0,20)}...</code> },
    { title: 'Date',    dataIndex: 'created_at', key: 'date', render: v => new Date(v).toLocaleString() },
    {
      title: 'Actions', key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" type="primary"
            onClick={() => { setModal({ open: true, record: r, action: 'approve' }); setTxhash(''); setNote(''); }}>
            Approve
          </Button>
          <Button size="small" danger
            onClick={() => { setModal({ open: true, record: r, action: 'reject' }); setTxhash(''); setNote(''); }}>
            Reject
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: '#fff', marginBottom: 16 }}>
        💸 Pending Withdrawals
      </Typography.Title>

      <Card style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 12 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={`${modal.action === 'approve' ? '✅ Approve' : '❌ Reject'} Withdrawal`}
        open={modal.open}
        onOk={handleProcess}
        onCancel={() => setModal({ open: false, record: null, action: '' })}
        okText="Confirm"
        okButtonProps={{ danger: modal.action === 'reject' }}
      >
        {modal.record && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>Amount: <strong>{parseFloat(modal.record.amount).toFixed(6)} {modal.record.symbol}</strong></div>
            <div>To: <code>{modal.record.to_address}</code></div>
            {modal.action === 'approve' && (
              <Input placeholder="Transaction Hash (txhash)" value={txhash} onChange={e => setTxhash(e.target.value)} />
            )}
            <Input.TextArea placeholder="Admin note (optional)" value={note} onChange={e => setNote(e.target.value)} rows={3} />
          </Space>
        )}
      </Modal>
    </div>
  );
}
