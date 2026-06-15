import { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import {
  LockOutlined, UserOutlined, ThunderboltOutlined,
  MailOutlined, SafetyOutlined, NumberOutlined,
  CheckCircleFilled
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = '/api/v1/admin';

const STEPS = [
  { key: 'pin',      label: 'PIN',      icon: <NumberOutlined /> },
  { key: 'password', label: 'Password', icon: <LockOutlined />   },
  { key: 'otp',      label: 'OTP',      icon: <MailOutlined />   },
  { key: '2fa',      label: '2FA',      icon: <SafetyOutlined /> },
];

export default function Login() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [stepToken, setStepToken]     = useState('');
  const [emailHint, setEmailHint]     = useState('');
  const [form]                        = Form.useForm();
  const navigate                      = useNavigate();

  const clearError = () => setError('');

  const handlePin = async (values) => {
    setLoading(true); clearError();
    try {
      const res = await axios.post(`${API}/verify-pin`, { pin: values.pin });
      setStepToken(res.data.data.step_token);
      setCurrentStep(1);
      form.resetFields();
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid PIN');
    } finally { setLoading(false); }
  };

  const handlePassword = async (values) => {
    setLoading(true); clearError();
    try {
      const res = await axios.post(`${API}/login`, {
        email: values.email, password: values.password, step_token: stepToken
      });
      const data = res.data.data;
      if (data.next_step === 3 && data.otp_sent) {
        setEmailHint(data.email_hint);
        setStepToken(data.step_token);
        setCurrentStep(2); form.resetFields(); return;
      }
      if (data.next_step === 4) {
        setStepToken(data.step_token);
        setCurrentStep(3); form.resetFields(); return;
      }
      if (data.access_token) {
        localStorage.setItem('admin_token', data.access_token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  const handleOTP = async (values) => {
    setLoading(true); clearError();
    try {
      const res = await axios.post(`${API}/verify-otp`, {
        otp: values.otp, step_token: stepToken
      });
      const data = res.data.data;
      if (data.next_step === 4) {
        setStepToken(data.step_token);
        setCurrentStep(3); form.resetFields(); return;
      }
      if (data.access_token) {
        localStorage.setItem('admin_token', data.access_token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const handle2FA = async (values) => {
    setLoading(true); clearError();
    try {
      const res = await axios.post(`${API}/verify-2fa`, {
        totp_code: values.totp_code, step_token: stepToken
      });
      localStorage.setItem('admin_token', res.data.data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid 2FA code');
    } finally { setLoading(false); }
  };

  const resetAll = () => {
    setCurrentStep(0); setStepToken('');
    setEmailHint(''); setError(''); form.resetFields();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #0a1628 0%, #000810 60%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '16px', fontFamily: "'Inter', sans-serif"
    }}>

      {/* CARD */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(145deg, #0d1f35 0%, #0a1628 100%)',
        border: '1px solid rgba(99,179,237,0.15)',
        borderRadius: 20,
        boxShadow: '0 0 60px rgba(0,100,255,0.08), 0 24px 48px rgba(0,0,0,0.6)',
        overflow: 'hidden'
      }}>

        {/* TOP ACCENT LINE */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, #1890ff, #096dd9, #1890ff)',
        }} />

        <div style={{ padding: '32px 28px 28px' }}>

          {/* LOGO */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, margin: '0 auto 12px',
              background: 'linear-gradient(135deg, #1890ff22, #096dd922)',
              border: '1px solid rgba(24,144,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ThunderboltOutlined style={{ fontSize: 32, color: '#1890ff' }} />
            </div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>
              VDExchange Admin
            </div>
            <div style={{ color: '#4a6fa5', fontSize: 13, marginTop: 4 }}>
              Secure Management Panel
            </div>
          </div>

          {/* STEP INDICATOR — HORIZONTAL */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: 28,
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            {STEPS.map((s, i) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
                {/* Step circle */}
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, transition: 'all 0.3s',
                    background: i < currentStep
                      ? 'linear-gradient(135deg, #52c41a, #389e0d)'
                      : i === currentStep
                        ? 'linear-gradient(135deg, #1890ff, #096dd9)'
                        : 'rgba(255,255,255,0.05)',
                    border: i === currentStep
                      ? '2px solid rgba(24,144,255,0.5)'
                      : i < currentStep
                        ? '2px solid rgba(82,196,26,0.5)'
                        : '2px solid rgba(255,255,255,0.1)',
                    color: i <= currentStep ? '#fff' : '#4a6fa5',
                    boxShadow: i === currentStep
                      ? '0 0 12px rgba(24,144,255,0.4)'
                      : 'none'
                  }}>
                    {i < currentStep
                      ? <CheckCircleFilled style={{ fontSize: 14 }} />
                      : s.icon
                    }
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                    color: i === currentStep ? '#1890ff'
                      : i < currentStep ? '#52c41a' : '#2a3f5f',
                    textTransform: 'uppercase'
                  }}>
                    {s.label}
                  </div>
                </div>
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div style={{
                    width: 28, height: 2, margin: '0 4px', marginBottom: 18,
                    background: i < currentStep
                      ? 'linear-gradient(90deg, #52c41a, #52c41a55)'
                      : 'rgba(255,255,255,0.07)',
                    borderRadius: 2, transition: 'all 0.3s'
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* ERROR */}
          {error && (
            <Alert
              message={error} type="error" showIcon closable
              onClose={clearError}
              style={{
                marginBottom: 20, borderRadius: 10,
                background: 'rgba(255,77,79,0.1)',
                border: '1px solid rgba(255,77,79,0.3)',
                color: '#ff4d4f'
              }}
            />
          )}

          {/* ── STEP 1: PIN ── */}
          {currentStep === 0 && (
            <Form form={form} onFinish={handlePin} layout="vertical">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ color: '#8aacce', fontSize: 14 }}>
                  Enter your 8-digit Security PIN
                </div>
              </div>
              <Form.Item name="pin" rules={[
                { required: true, message: 'PIN is required' },
                { len: 8, message: 'Must be exactly 8 digits' },
                { pattern: /^\d+$/, message: 'Digits only' }
              ]}>
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#4a6fa5' }} />}
                  placeholder="• • • • • • • •"
                  maxLength={8}
                  size="large"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(99,179,237,0.2)',
                    borderRadius: 10, color: '#fff',
                    letterSpacing: 10, fontSize: 18,
                    textAlign: 'center', height: 52
                  }}
                />
              </Form.Item>
              <Button
                type="primary" htmlType="submit"
                loading={loading} block size="large"
                style={{
                  height: 50, borderRadius: 10, fontSize: 15,
                  fontWeight: 600, letterSpacing: 0.5,
                  background: 'linear-gradient(135deg, #1890ff, #096dd9)',
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(24,144,255,0.35)'
                }}
              >
                Verify PIN →
              </Button>
            </Form>
          )}

          {/* ── STEP 2: EMAIL + PASSWORD ── */}
          {currentStep === 1 && (
            <Form form={form} onFinish={handlePassword} layout="vertical">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ color: '#8aacce', fontSize: 14 }}>
                  Enter your admin credentials
                </div>
              </div>
              <Form.Item name="email" rules={[
                { required: true, type: 'email', message: 'Valid email required' }
              ]}>
                <Input
                  prefix={<UserOutlined style={{ color: '#4a6fa5' }} />}
                  placeholder="Admin Email"
                  size="large"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(99,179,237,0.2)',
                    borderRadius: 10, color: '#fff', height: 50
                  }}
                />
              </Form.Item>
              <Form.Item name="password" rules={[
                { required: true, message: 'Password required' }
              ]}>
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#4a6fa5' }} />}
                  placeholder="Password"
                  size="large"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(99,179,237,0.2)',
                    borderRadius: 10, color: '#fff', height: 50
                  }}
                />
              </Form.Item>
              <Button
                type="primary" htmlType="submit"
                loading={loading} block size="large"
                style={{
                  height: 50, borderRadius: 10, fontSize: 15,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #1890ff, #096dd9)',
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(24,144,255,0.35)'
                }}
              >
                Verify Password →
              </Button>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <span onClick={resetAll} style={{
                  color: '#4a6fa5', fontSize: 12, cursor: 'pointer'
                }}>← Start over</span>
              </div>
            </Form>
          )}

          {/* ── STEP 3: OTP ── */}
          {currentStep === 2 && (
            <Form form={form} onFinish={handleOTP} layout="vertical">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  background: 'rgba(82,196,26,0.1)',
                  border: '1px solid rgba(82,196,26,0.25)',
                  borderRadius: 10, padding: '10px 16px', marginBottom: 12
                }}>
                  <MailOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  <span style={{ color: '#8aacce', fontSize: 13 }}>
                    OTP sent to{' '}
                    <span style={{ color: '#1890ff', fontWeight: 600 }}>
                      {emailHint}
                    </span>
                  </span>
                </div>
                <div style={{ color: '#4a6fa5', fontSize: 12 }}>
                  Valid for 5 minutes
                </div>
              </div>
              <Form.Item name="otp" rules={[
                { required: true, message: 'OTP required' },
                { len: 6, message: 'Must be 6 digits' },
                { pattern: /^\d+$/, message: 'Digits only' }
              ]}>
                <Input
                  prefix={<SafetyOutlined style={{ color: '#4a6fa5' }} />}
                  placeholder="6-digit OTP"
                  maxLength={6}
                  size="large"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(99,179,237,0.2)',
                    borderRadius: 10, color: '#fff',
                    letterSpacing: 8, fontSize: 20,
                    textAlign: 'center', height: 52
                  }}
                />
              </Form.Item>
              <Button
                type="primary" htmlType="submit"
                loading={loading} block size="large"
                style={{
                  height: 50, borderRadius: 10, fontSize: 15,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #52c41a, #389e0d)',
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(82,196,26,0.3)'
                }}
              >
                Verify OTP →
              </Button>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <span onClick={resetAll} style={{
                  color: '#4a6fa5', fontSize: 12, cursor: 'pointer'
                }}>← Start over</span>
              </div>
            </Form>
          )}

          {/* ── STEP 4: 2FA ── */}
          {currentStep === 3 && (
            <Form form={form} onFinish={handle2FA} layout="vertical">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  background: 'rgba(250,173,20,0.1)',
                  border: '1px solid rgba(250,173,20,0.25)',
                  borderRadius: 10, padding: '10px 16px'
                }}>
                  <SafetyOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  <span style={{ color: '#8aacce', fontSize: 13 }}>
                    Open Google Authenticator
                  </span>
                </div>
              </div>
              <Form.Item name="totp_code" rules={[
                { required: true, message: '2FA code required' },
                { len: 6, message: 'Must be 6 digits' },
                { pattern: /^\d+$/, message: 'Digits only' }
              ]}>
                <Input
                  prefix={<SafetyOutlined style={{ color: '#4a6fa5' }} />}
                  placeholder="6-digit code"
                  maxLength={6}
                  size="large"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(99,179,237,0.2)',
                    borderRadius: 10, color: '#fff',
                    letterSpacing: 8, fontSize: 20,
                    textAlign: 'center', height: 52
                  }}
                />
              </Form.Item>
              <Button
                type="primary" htmlType="submit"
                loading={loading} block size="large"
                style={{
                  height: 50, borderRadius: 10, fontSize: 15,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #faad14, #d48806)',
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(250,173,20,0.3)'
                }}
              >
                Verify 2FA →
              </Button>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <span onClick={resetAll} style={{
                  color: '#4a6fa5', fontSize: 12, cursor: 'pointer'
                }}>← Start over</span>
              </div>
            </Form>
          )}

        </div>

        {/* BOTTOM */}
        <div style={{
          padding: '12px 28px 20px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          textAlign: 'center',
          color: '#1e3a5f', fontSize: 11, letterSpacing: 0.5
        }}>
          VDExchange © 2026 — All rights reserved
        </div>

      </div>
    </div>
  );
}
