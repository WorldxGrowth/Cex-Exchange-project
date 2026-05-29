import { useEffect, useState } from 'react';
import { Table, Card, Button, Tag, Space, Typography,
         Modal, Input, Select, Row, Col, message, Descriptions } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

const { Text } = Typography;

export default function Withdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const ADMIN_PIN = '123456'; // Change this!

  const load = async () => {
    setLoading(true);
    try {
      const res = filterStatus === 'pending'
        ? await adminAPI.getPendingWithdrawals()
        : await adminAPI.getWithdrawals({ status: filterStatus });
      setWithdrawals(res.data || []);
    } catch { message.error('Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const handleApproveConfirm = () => {
    if (pin !== ADMIN_PIN) {
      message.error('Wrong PIN!');
      return;
    }
    doApprove();
  };

  const doApprove = async () => {
    try {
      await adminAPI.processWithdrawal(selected.id, { action: 'approve' });
      message.success('✅ Withdrawal approved & processing!');
      setPinModal(false);
      setPin('');
      setSelected(null);
      load();
    } catch (e) { message.error(e?.message || 'Failed'); }
  };

  const doReject = async () => {
    if (!rejectReason) { message.error('Enter reason'); return; }
    try {
      await adminAPI.processWithdrawal(selected.id, {
        action: 'reject', admin_note: rejectReason
      });
      message.success('Withdrawal rejected & refunded');
      setRejectModal(false);
      setRejectReason('');
      setSelected(null);
      load();
    } catch { message.error('Failed'); }
  };

  const columns = [
    { title: 'User', key: 'user',
      render: (_, r) => <div>
        <Text style={{ color: '#fff', fontSize: 12 }}>{r.email}</Text><br/>
        <Text style={{ color: '#848e9c', fontSize: 10 }}>{r.uid}</Text>
      </div> },
    { title: 'Coin', key: 'coin', width: 80,
      render: (_, r) => <Tag color="blue">{r.symbol}</Tag> },
    { title: 'Amount', key: 'amount',
      render: (_, r) => <div>
        <Text style={{ color: '#f6465d', fontWeight: 700 }}>
          {parseFloat(r.amount).toFixed(6)}
        </Text><br/>
        <Text style={{ color: '#848e9c', fontSize: 11 }}>
          Fee: {parseFloat(r.fee || 0).toFixed(4)}
        </Text>
      </div> },
    { title: 'To Address', dataIndex: 'to_address', key: 'address',
      render: v => <Text copyable={{ text: v }} style={{ color: '#1890ff', fontSize: 11 }}>
        {v?.slice(0,10)}...{v?.slice(-6)}
      </Text> },
    { title: 'Network', key: 'network',
      render: (_, r) => <Tag>{r.network_name}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status',
      render: v => <Tag color={
        v==='completed'?'green':v==='pending'?'orange':v==='failed'?'red':'default'
      }>{v}</Tag> },
    { title: 'Time', dataIndex: 'created_at', key: 'time', width: 120,
      render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>
        {new Date(v).toLocaleString()}
      </Text> },
    { title: 'Actions', key: 'actions', fixed: 'right', width: 180,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => setSelected(r)}>Detail</Button>
          {r.status === 'pending' && <>
            <Button size="small" type="primary" icon={<CheckOutlined />}
              onClick={() => { setSelected(r); setPinModal(true); }}>
              Approve
            </Button>
            <Button size="small" danger icon={<CloseOutlined />}
              onClick={() => { setSelected(r); setRejectModal(true); }}>
              Reject
            </Button>
          </>}
        </Space>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    marginBottom: 16, alignItems: 'center' }}>
        <Text strong style={{ color: '#fff', fontSize: 18 }}>📤 Withdrawal Management</Text>
        <Select value={filterStatus} style={{ width: 140 }}
          onChange={setFilterStatus}>
          <Select.Option value="">All</Select.Option>
          <Select.Option value="pending">Pending</Select.Option>
          <Select.Option value="completed">Completed</Select.Option>
          <Select.Option value="failed">Failed</Select.Option>
          <Select.Option value="cancelled">Cancelled</Select.Option>
        </Select>
      </div>

      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
        <Table dataSource={withdrawals} columns={columns} rowKey="id"
          loading={loading} scroll={{ x: 900 }} />
      </Card>

      {/* Detail Modal */}
      <Modal title={<Text style={{ color: '#fff' }}>Withdrawal Detail</Text>}
        open={!!selected && !pinModal && !rejectModal}
        onCancel={() => setSelected(null)} footer={null} width={600}>
        {selected && (
          <Descriptions bordered size="small" column={2}
            labelStyle={{ color: '#848e9c' }} contentStyle={{ color: '#fff' }}>
            <Descriptions.Item label="TX ID" span={2}>{selected.tx_id}</Descriptions.Item>
            <Descriptions.Item label="User">{selected.email}</Descriptions.Item>
            <Descriptions.Item label="Coin">{selected.symbol}</Descriptions.Item>
            <Descriptions.Item label="Amount">{selected.amount}</Descriptions.Item>
            <Descriptions.Item label="Fee">{selected.fee}</Descriptions.Item>
            <Descriptions.Item label="To Address" span={2}>{selected.to_address}</Descriptions.Item>
            <Descriptions.Item label="Network">{selected.network_name}</Descriptions.Item>
            <Descriptions.Item label="Status">{selected.status}</Descriptions.Item>
            {selected.txhash && (
              <Descriptions.Item label="TX Hash" span={2}>{selected.txhash}</Descriptions.Item>
            )}
            {selected.notes && (
              <Descriptions.Item label="Notes" span={2}>{selected.notes}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* PIN Confirm Modal */}
      <Modal
        title={<Text style={{ color: '#f0b90b' }}>🔐 Enter Admin PIN to Approve</Text>}
        open={pinModal}
        onCancel={() => { setPinModal(false); setPin(''); }}
        onOk={handleApproveConfirm}
        okText="Confirm Approve"
        okButtonProps={{ type: 'primary' }}
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Text style={{ color: '#848e9c', display: 'block', marginBottom: 16 }}>
            Approving withdrawal of{' '}
            <strong style={{ color: '#f0b90b' }}>
              {selected?.amount} {selected?.symbol}
            </strong>
            {' '}to{' '}
            <strong style={{ color: '#1890ff' }}>
              {selected?.to_address?.slice(0,12)}...
            </strong>
          </Text>
          <Input.Password
            placeholder="6-digit PIN"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g,''))}
            size="large"
            style={{ textAlign: 'center', letterSpacing: 8, fontSize: 20, width: 200 }}
          />
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal title="Reject Withdrawal" open={rejectModal}
        onCancel={() => setRejectModal(false)}
        onOk={doReject} okText="Reject & Refund" okButtonProps={{ danger: true }}>
        <Text style={{ color: '#848e9c', display: 'block', marginBottom: 12 }}>
          Amount will be refunded to user's spot balance.
        </Text>
        <Input.TextArea rows={3} placeholder="Rejection reason..."
          value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
      </Modal>
    </div>
  );
}
