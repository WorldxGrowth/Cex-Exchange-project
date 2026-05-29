import { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Row, Col,
         Statistic, Badge, Button, message } from 'antd';
import { ReloadOutlined, CheckCircleOutlined,
         ClockCircleOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

const { Text } = Typography;

export default function Scanner() {
  const [scannerState, setScannerState] = useState([]);
  const [recentDeposits, setRecentDeposits] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [scanner, deps] = await Promise.all([
        adminAPI.getScannerState(),
        adminAPI.getDeposits({ limit: 20 })
      ]);
      setScannerState(scanner.data || []);
      setRecentDeposits((deps.data?.deposits || deps.data || []).slice(0, 20));
    } catch { message.error('Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const networkColors = { BSC: '#f0b90b', ETH: '#627eea', VDCHAIN: '#0ecb81', ETH_NET: '#627eea' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    marginBottom: 16, alignItems: 'center' }}>
        <Text strong style={{ color: '#fff', fontSize: 18 }}>🔍 Scanner Dashboard</Text>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Network Status Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {scannerState.length > 0 ? scannerState.map(s => (
          <Col xs={24} sm={8} key={s.network}>
            <Card style={{ background: '#1e2026', border: `1px solid ${networkColors[s.network] || '#2b2f36'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong style={{ color: networkColors[s.network] || '#fff', fontSize: 16 }}>
                    {s.network}
                  </Text>
                  <br/>
                  <Text style={{ color: '#848e9c', fontSize: 11 }}>
                    Last block: {parseInt(s.last_block || 0).toLocaleString()}
                  </Text>
                  <br/>
                  <Text style={{ color: '#848e9c', fontSize: 11 }}>
                    {s.last_scan_at
                      ? `Scanned: ${new Date(s.last_scan_at).toLocaleTimeString()}`
                      : 'Not started'}
                  </Text>
                </div>
                <Badge status="processing" color="green" text={
                  <Text style={{ color: '#0ecb81' }}>Active</Text>
                } />
              </div>
            </Card>
          </Col>
        )) : (
          // Fallback static display
          ['BSC', 'ETH', 'VDCHAIN'].map(net => (
            <Col xs={24} sm={8} key={net}>
              <Card style={{ background: '#1e2026', border: `1px solid ${networkColors[net]}30` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <Text strong style={{ color: networkColors[net], fontSize: 16 }}>{net}</Text>
                    <br/>
                    <Text style={{ color: '#848e9c', fontSize: 11 }}>Auto-scanning</Text>
                  </div>
                  <Badge status="processing" color="green"
                    text={<Text style={{ color: '#0ecb81' }}>Online</Text>} />
                </div>
              </Card>
            </Col>
          ))
        )}
      </Row>

      {/* Recent Deposits */}
      <Card title={<Text style={{ color: '#fff' }}>📥 Recent Detected Deposits</Text>}
        style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
        <Table
          dataSource={recentDeposits}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
          columns={[
            { title: 'Network', dataIndex: 'network', key: 'net',
              render: v => <Tag color={v==='BSC'?'gold':v==='VDCHAIN'?'green':'blue'}>{v}</Tag> },
            { title: 'User', dataIndex: 'email', key: 'email',
              render: v => <Text style={{ color: '#fff', fontSize: 11 }}>{v}</Text> },
            { title: 'Coin', dataIndex: 'symbol', key: 'coin',
              render: v => <Tag>{v}</Tag> },
            { title: 'Amount', key: 'amt',
              render: (_, r) => <Text style={{ color: '#0ecb81', fontWeight: 600 }}>
                +{parseFloat(r.amount).toFixed(6)}
              </Text> },
            { title: 'TX Hash', dataIndex: 'txhash', key: 'tx',
              render: v => <Text style={{ color: '#1890ff', fontSize: 11 }}>
                {v ? `${v.slice(0,10)}...${v.slice(-6)}` : '-'}
              </Text> },
            { title: 'Status', dataIndex: 'status', key: 'status',
              render: v => <Tag color="green">{v}</Tag> },
            { title: 'Time', dataIndex: 'created_at', key: 'time',
              render: v => <Text style={{ color: '#848e9c', fontSize: 11 }}>
                {new Date(v).toLocaleString()}
              </Text> },
          ]}
        />
      </Card>
    </div>
  );
}
