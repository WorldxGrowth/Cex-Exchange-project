import { useEffect, useState } from 'react';
import { Table, Card, Button, Tag, Space, Typography, 
         Modal, Input, Image, Row, Col, Select, message, Descriptions } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

const { Text } = Typography;

export default function KYC() {
  const [kycs, setKycs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');

  const loadKYC = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getKYCList({ status: filterStatus });
      setKycs(res.data || []);
    } catch { message.error('Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadKYC(); }, [filterStatus]);

  const handleApprove = async (id) => {
    try {
      await adminAPI.approveKYC(id, { action: 'approved' });
      message.success('KYC Approved!');
      loadKYC();
      setSelected(null);
    } catch { message.error('Failed'); }
  };

  const handleReject = async () => {
    if (!rejectReason) { message.error('Enter rejection reason'); return; }
    try {
      await adminAPI.approveKYC(selected.id, { action: 'rejected', rejection_reason: rejectReason });
      message.success('KYC Rejected');
      loadKYC();
      setSelected(null);
      setRejectModal(false);
      setRejectReason('');
    } catch { message.error('Failed'); }
  };

  const columns = [
    { title: 'User', key: 'user',
      render: (_, r) => <div>
        <Text style={{ color: '#fff' }}>{r.email}</Text><br/>
        <Text style={{ color: '#848e9c', fontSize: 11 }}>UID: {r.uid}</Text>
      </div> },
    { title: 'Full Name', dataIndex: 'full_name', key: 'name',
      render: v => <Text style={{ color: '#fff' }}>{v}</Text> },
    { title: 'ID Type', dataIndex: 'id_type', key: 'id_type',
      render: v => <Tag>{v?.replace('_', ' ').toUpperCase()}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status',
      render: v => <Tag color={v==='pending'?'orange':v==='approved'?'green':'red'}>{v}</Tag> },
    { title: 'Submitted', dataIndex: 'created_at', key: 'date',
      render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>
        {new Date(v).toLocaleString()}
      </Text> },
    { title: 'Actions', key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => setSelected(r)}>Review</Button>
          {r.status === 'pending' && <>
            <Button size="small" type="primary" icon={<CheckOutlined />}
              onClick={() => handleApprove(r.id)}>Approve</Button>
            <Button size="small" danger icon={<CloseOutlined />}
              onClick={() => { setSelected(r); setRejectModal(true); }}>Reject</Button>
          </>}
        </Space>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ color: '#fff', fontSize: 18 }}>🪪 KYC Management</Text>
        <Select value={filterStatus} style={{ width: 140 }}
          onChange={setFilterStatus}>
          <Select.Option value="pending">Pending</Select.Option>
          <Select.Option value="approved">Approved</Select.Option>
          <Select.Option value="rejected">Rejected</Select.Option>
        </Select>
      </div>

      <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
        <Table dataSource={kycs} columns={columns} rowKey="id"
          loading={loading} scroll={{ x: 700 }} />
      </Card>

      {/* KYC Detail Modal */}
      <Modal
        title={<Text style={{ color: '#fff' }}>KYC Review - {selected?.full_name}</Text>}
        open={!!selected && !rejectModal}
        onCancel={() => setSelected(null)}
        width={800}
        footer={selected?.status === 'pending' ? [
          <Button key="reject" danger onClick={() => setRejectModal(true)}>
            Reject
          </Button>,
          <Button key="approve" type="primary" onClick={() => handleApprove(selected.id)}>
            ✅ Approve KYC
          </Button>,
        ] : null}
      >
        {selected && (
          <div>
            <Descriptions bordered size="small" column={2}
              labelStyle={{ color: '#848e9c' }} contentStyle={{ color: '#fff' }}>
              <Descriptions.Item label="Full Name">{selected.full_name}</Descriptions.Item>
              <Descriptions.Item label="ID Type">{selected.id_type}</Descriptions.Item>
              <Descriptions.Item label="ID Number">{selected.id_number}</Descriptions.Item>
              <Descriptions.Item label="Nationality">{selected.nationality}</Descriptions.Item>
              <Descriptions.Item label="DOB">{selected.date_of_birth}</Descriptions.Item>
              <Descriptions.Item label="Address" span={2}>{selected.address}</Descriptions.Item>
            </Descriptions>

            <Row gutter={16} style={{ marginTop: 16 }}>
              {selected.id_front_url && (
                <Col span={8}>
                  <Text style={{ color: '#848e9c', display: 'block', marginBottom: 4 }}>
                    ID Front
                  </Text>
                  <Image src={selected.id_front_url} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
              )}
              {selected.id_back_url && (
                <Col span={8}>
                  <Text style={{ color: '#848e9c', display: 'block', marginBottom: 4 }}>
                    ID Back
                  </Text>
                  <Image src={selected.id_back_url} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
              )}
              {selected.selfie_url && (
                <Col span={8}>
                  <Text style={{ color: '#848e9c', display: 'block', marginBottom: 4 }}>
                    Selfie with ID
                  </Text>
                  <Image src={selected.selfie_url} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal title="Reject KYC" open={rejectModal}
        onCancel={() => setRejectModal(false)}
        onOk={handleReject} okText="Reject" okButtonProps={{ danger: true }}>
        <Input.TextArea rows={3} placeholder="Enter rejection reason..."
          value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
      </Modal>
    </div>
  );
}
