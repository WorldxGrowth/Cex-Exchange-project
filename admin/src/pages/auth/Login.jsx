import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../services/api';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.login(values);
      localStorage.setItem('admin_token', res.data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #001529 0%, #003366 50%, #001529 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Card style={{
        width: 420,
        background: '#141414',
        border: '1px solid #303030',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <Space direction="vertical" style={{ width: '100%' }} size={24}>
          <div style={{ textAlign: 'center' }}>
            <ThunderboltOutlined style={{ fontSize: 40, color: '#1890ff' }} />
            <Typography.Title level={3} style={{ color: '#fff', margin: '8px 0 0' }}>
              VDExchange Admin
            </Typography.Title>
            <Typography.Text style={{ color: '#888' }}>
              Management Panel
            </Typography.Text>
          </div>

          {error && <Alert message={error} type="error" showIcon />}

          <Form onFinish={onFinish} layout="vertical" size="large">
            <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
              <Input
                prefix={<UserOutlined style={{ color: '#888' }} />}
                placeholder="Admin Email"
                style={{ background: '#1f1f1f', borderColor: '#303030', color: '#fff' }}
              />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true }]}>
              <Input.Password
                prefix={<LockOutlined style={{ color: '#888' }} />}
                placeholder="Password"
                style={{ background: '#1f1f1f', borderColor: '#303030', color: '#fff' }}
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{ height: 48, fontSize: 16, borderRadius: 8 }}
            >
              Login to Admin Panel
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
