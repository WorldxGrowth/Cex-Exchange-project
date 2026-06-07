import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Table, Tag, Select, Spin, Statistic } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
         ResponsiveContainer, Legend } from 'recharts';
import { adminAPI } from '../../services/api';

export default function Reports() {
  const [treasury, setTreasury] = useState(null);
  const [volume, setVolume] = useState(null);
  const [holdings, setHoldings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const fetch = async (d) => {
    setLoading(true);
    try {
      const [tRes, vRes, hRes] = await Promise.all([
        adminAPI.getTreasuryReport({ days: d }),
        adminAPI.getVolumeReport({ days: d }),
        adminAPI.getHoldingsReport(),
      ]);
      setTreasury(tRes.data);
      setVolume(vRes.data);
      setHoldings(hRes.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(days); }, [days]);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

  const totalTreasuryUsdt = treasury?.balances?.reduce(
    (sum, b) => sum + parseFloat(b.usdt_value || 0), 0
  ) || 0;

  const totalFees = treasury?.top_coins?.reduce(
    (sum, c) => sum + parseFloat(c.total_fee || 0), 0
  ) || 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          📊 Reports & Analytics
        </Typography.Title>
        <Select value={days} onChange={setDays} style={{ width: 120 }}>
          <Select.Option value={7}>Last 7 Days</Select.Option>
          <Select.Option value={30}>Last 30 Days</Select.Option>
          <Select.Option value={90}>Last 90 Days</Select.Option>
        </Select>
      </div>

      {/* Summary Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
            <Statistic title="Treasury Value" value={totalTreasuryUsdt.toFixed(4)}
              prefix="$" valueStyle={{ color: '#f0b90b', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
            <Statistic title={`Fee Income (${days}d)`} value={totalFees.toFixed(6)}
              valueStyle={{ color: '#0ecb81', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
            <Statistic title={`Spread Profit (${days}d)`}
              value={treasury?.spread_history?.reduce((s, r) => s + parseFloat(r.spread || 0), 0).toFixed(6) || '0'}
              valueStyle={{ color: '#1890ff', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
            <Statistic title={`Volume (${days}d)`}
              value={volume?.daily?.reduce((s, r) => s + parseFloat(r.volume || 0), 0).toFixed(2) || '0'}
              prefix="$" valueStyle={{ color: '#722ed1', fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {/* Treasury Balances */}
        <Col xs={24} lg={12}>
          <Card title={<Typography.Text style={{ color: '#fff' }}>💰 Treasury Balances</Typography.Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
            <Table
              dataSource={treasury?.balances || []}
              rowKey="symbol" pagination={false} size="small"
              columns={[
                { title: 'Coin', dataIndex: 'symbol', render: v => <Tag color="blue">{v}</Tag> },
                { title: 'Available', dataIndex: 'available',
                  render: v => parseFloat(v).toFixed(8) },
                { title: 'USDT Value', dataIndex: 'usdt_value',
                  render: v => <Tag color="gold">${parseFloat(v).toFixed(4)}</Tag> },
              ]}
            />
          </Card>
        </Col>

        {/* Top Fee Coins */}
        <Col xs={24} lg={12}>
          <Card title={<Typography.Text style={{ color: '#fff' }}>🏆 Top Fee Coins</Typography.Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
            <Table
              dataSource={treasury?.top_coins || []}
              rowKey="symbol" pagination={false} size="small"
              columns={[
                { title: 'Coin', dataIndex: 'symbol', render: v => <Tag color="blue">{v}</Tag> },
                { title: 'Total Fee', dataIndex: 'total_fee',
                  render: v => <Tag color="green">{parseFloat(v).toFixed(8)}</Tag> },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Volume Chart */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24}>
          <Card title={<Typography.Text style={{ color: '#fff' }}>📈 Daily Volume</Typography.Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
            {volume?.daily?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volume.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b2f36" />
                  <XAxis dataKey="date" stroke="#848e9c" fontSize={10} />
                  <YAxis stroke="#848e9c" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#2b2f36', border: 'none' }} />
                  <Legend />
                  <Bar dataKey="volume" fill="#f0b90b" name="Volume ($)" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: '#848e9c' }}>No data</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Top Pairs */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card title={<Typography.Text style={{ color: '#fff' }}>🔄 Volume by Pair</Typography.Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
            <Table dataSource={volume?.by_pair || []} rowKey="symbol"
              pagination={false} size="small"
              columns={[
                { title: 'Pair', dataIndex: 'symbol', render: v => <Tag color="blue">{v}</Tag> },
                { title: 'Trades', dataIndex: 'trades' },
                { title: 'Volume', dataIndex: 'volume',
                  render: v => <Tag color="gold">${parseFloat(v).toFixed(2)}</Tag> },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Typography.Text style={{ color: '#fff' }}>👑 Top Traders</Typography.Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
            <Table dataSource={volume?.by_user?.slice(0,10) || []} rowKey="uid"
              pagination={false} size="small"
              columns={[
                { title: 'User', dataIndex: 'email',
                  render: v => v?.split('@')[0] },
                { title: 'Trades', dataIndex: 'trades' },
                { title: 'Volume', dataIndex: 'volume',
                  render: v => <Tag color="gold">${parseFloat(v).toFixed(2)}</Tag> },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Coin Holdings Report */}
      <Row gutter={[12,12]} style={{ marginTop: 12 }}>
        <Col xs={24}>
          <Card
            title={<Typography.Text style={{ color: '#fff' }}>Coin Holdings Report</Typography.Text>}
            extra={<Typography.Text style={{ color: '#f0b90b' }}>
              Total User Value: ${parseFloat(holdings?.summary?.total_user_holdings_usdt||0).toLocaleString()}
            </Typography.Text>}
            style={{ background: '#1e2026', border: '1px solid #2b2f36' }}>
            <Table
              dataSource={holdings?.coins || []}
              rowKey="symbol"
              size="small"
              scroll={{ x: 900 }}
              pagination={{ pageSize: 15 }}
              columns={[
                { title: 'Coin', dataIndex: 'symbol', width: 130,
                  render: (sym, r) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.logo_url
                        ? <img src={r.logo_url} alt="" style={{ width:24, height:24, borderRadius:'50%' }} />
                        : <div style={{ width:24, height:24, borderRadius:'50%',
                            background:'#f0b90b20', display:'flex', alignItems:'center',
                            justifyContent:'center', fontSize:11, color:'#f0b90b', fontWeight:700 }}>
                            {sym?.charAt(0)}
                          </div>
                      }
                      <div>
                        <div style={{ fontWeight:700, color:'#fff', fontSize:13 }}>{sym}</div>
                        <div style={{ fontSize:10, color:'#848e9c' }}>{r.name}</div>
                      </div>
                    </div>
                  )
                },
                { title: 'Chain', dataIndex: 'network', width: 80,
                  render: v => v ? <Tag color="blue">{v}</Tag> : <Tag>-</Tag> },
                { title: 'Price', dataIndex: 'price_usdt', width: 110,
                  render: v => v ? `$${parseFloat(v).toFixed(6)}` : '-' },
                { title: 'User Balance', dataIndex: 'total_user_balance', width: 130,
                  render: (v, r) => v ? `${parseFloat(v).toFixed(4)} ${r.symbol}` : '0' },
                { title: 'User Value', dataIndex: 'total_user_usdt', width: 120,
                  render: v => <Tag color="gold">${parseFloat(v||0).toFixed(2)}</Tag>,
                  sorter: (a,b) => parseFloat(a.total_user_usdt||0) - parseFloat(b.total_user_usdt||0),
                  defaultSortOrder: 'descend' },
                { title: 'Holders', dataIndex: 'holders', width: 80,
                  render: v => <Tag color="green">{v||0}</Tag> },
                { title: 'Deposited', dataIndex: 'total_deposited', width: 120,
                  render: (v, r) => v ? `${parseFloat(v).toFixed(4)} ${r.symbol}` : '-' },
                { title: 'Withdrawn', dataIndex: 'total_withdrawn', width: 120,
                  render: (v, r) => v ? `${parseFloat(v).toFixed(4)} ${r.symbol}` : '-' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
