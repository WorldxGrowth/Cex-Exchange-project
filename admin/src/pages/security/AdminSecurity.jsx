import { useEffect, useState } from 'react';
import { Card, Button, Input, Typography, message, Tag, Space, Divider, Alert, Modal, Switch } from 'antd';
import {
  SafetyOutlined, QrcodeOutlined, CheckCircleOutlined,
  CloseCircleOutlined, KeyOutlined, MailOutlined, LockOutlined,
  EditOutlined
} from '@ant-design/icons';
import { adminAPI } from '../../services/api';

const { Title, Text } = Typography;

export default function AdminSecurity() {
  const [status, setStatus]               = useState(null);
  const [loading, setLoading]             = useState(true);
  const [qrData, setQrData]               = useState(null);
  const [secret, setSecret]               = useState('');
  const [step, setStep]                   = useState('idle');
  const [totpCode, setTotpCode]           = useState('');
  const [disableCode, setDisableCode]     = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [otpToggling, setOtpToggling]     = useState(false);
  const [disableModal, setDisableModal]   = useState(false);

  // PIN Change states
  const [pinModal, setPinModal]           = useState(false);
  const [pinStep, setPinStep]             = useState(1);
  const [pinLoading, setPinLoading]       = useState(false);
  const [currentPin, setCurrentPin]       = useState('');
  const [newPin, setNewPin]               = useState('');
  const [confirmPin, setConfirmPin]       = useState('');
  const [pinOtp, setPinOtp]               = useState('');
  const [pinEmailHint, setPinEmailHint]   = useState('');

  const fetchStatus = async () => {
    try {
      const res = await adminAPI.get2FAStatus();
      setStatus(res.data);
    } catch (e) {
      message.error('Failed to load security status');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchStatus(); }, []);

  // ── 2FA Setup ──
  const handleSetup = async () => {
    setActionLoading(true);
    try {
      const res = await adminAPI.setup2FA();
      setQrData(res.data.qr_code);
      setSecret(res.data.secret);
      setStep('verify');
      message.success('QR Code generated! Scan with Google Authenticator.');
    } catch (e) {
      message.error(e?.message || 'Setup failed');
    } finally { setActionLoading(false); }
  };

  const handleEnable = async () => {
    if (!totpCode || totpCode.length !== 6) {
      message.error('Enter 6-digit code from Google Authenticator');
      return;
    }
    setActionLoading(true);
    try {
      await adminAPI.enable2FA({ totp_code: totpCode });
      message.success('2FA Enabled Successfully!');
      setStep('idle'); setQrData(null); setTotpCode('');
      fetchStatus();
    } catch (e) {
      message.error(e?.message || 'Enable failed');
    } finally { setActionLoading(false); }
  };

  const handleDisable = async () => {
    if (!disableCode || disableCode.length !== 6) {
      message.error('Enter 6-digit code to confirm disable');
      return;
    }
    setActionLoading(true);
    try {
      await adminAPI.disable2FA({ totp_code: disableCode });
      message.success('2FA Disabled');
      setDisableModal(false); setDisableCode('');
      fetchStatus();
    } catch (e) {
      message.error(e?.message || 'Disable failed');
    } finally { setActionLoading(false); }
  };

  // ── OTP Toggle ──
  const handleToggleOTP = async (checked) => {
    setOtpToggling(true);
    try {
      const res = await adminAPI.toggleOTP();
      setStatus(prev => ({ ...prev, otp_enabled: res.data.otp_enabled }));
      message.success(res.data.otp_enabled ? 'Gmail OTP Enabled!' : 'Gmail OTP Disabled!');
    } catch (e) {
      message.error(e?.message || 'Toggle failed');
    } finally { setOtpToggling(false); }
  };

  // ── PIN Change ──
  const handlePinStep1 = async () => {
    if (!currentPin || currentPin.length !== 8) {
      message.error('Enter current 8-digit PIN'); return;
    }
    if (!newPin || newPin.length !== 8) {
      message.error('New PIN must be 8 digits'); return;
    }
    if (newPin !== confirmPin) {
      message.error('New PIN and confirm PIN do not match'); return;
    }
    setPinLoading(true);
    try {
      const res = await adminAPI.changePinStep1({
        current_pin: currentPin,
        new_pin: newPin,
        confirm_pin: confirmPin
      });
      setPinEmailHint(res.data.email_hint);
      setPinStep(2);
      message.success('OTP sent to your email!');
    } catch (e) {
      message.error(e?.message || 'Verification failed');
    } finally { setPinLoading(false); }
  };

  const handlePinStep2 = async () => {
    if (!pinOtp || pinOtp.length !== 6) {
      message.error('Enter 6-digit OTP'); return;
    }
    setPinLoading(true);
    try {
      await adminAPI.changePinStep2({ otp: pinOtp });
      message.success('PIN changed successfully!');
      setPinModal(false);
      setPinStep(1);
      setCurrentPin(''); setNewPin('');
      setConfirmPin(''); setPinOtp('');
    } catch (e) {
      message.error(e?.message || 'PIN change failed');
    } finally { setPinLoading(false); }
  };

  const resetPinModal = () => {
    setPinModal(false); setPinStep(1);
    setCurrentPin(''); setNewPin('');
    setConfirmPin(''); setPinOtp('');
  };

  const cardStyle = {
    background: '#1f1f1f',
    border: '1px solid #303030',
    borderRadius: 12,
    marginBottom: 16
  };

  const inputStyle = {
    background: '#0b0e11',
    border: '1px solid #303030',
    color: '#fff',
    letterSpacing: 6,
    fontSize: 18,
    textAlign: 'center'
  };

  if (loading) return (
    <div style={{ color: '#fff', padding: 32, textAlign: 'center' }}>
      Loading security settings...
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Title level={4} style={{ color: '#fff', marginBottom: 20 }}>
        🔐 Admin Security Settings
      </Title>

      {/* ── Gmail OTP Card ── */}
      <Card style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MailOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <div>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Gmail OTP on Login</Text>
              <div><Text style={{ color: '#848e9c', fontSize: 13 }}>6-digit OTP sent to email on every login</Text></div>
            </div>
          </div>
          <Space>
            <Tag
              color={status?.otp_enabled ? 'green' : 'red'}
              style={{ fontSize: 12, padding: '2px 10px', borderRadius: 8 }}
            >
              {status?.otp_enabled ? '✓ ON' : '✗ OFF'}
            </Tag>
            <Switch
              checked={status?.otp_enabled}
              loading={otpToggling}
              onChange={handleToggleOTP}
              checkedChildren="ON"
              unCheckedChildren="OFF"
            />
          </Space>
        </div>
        <Divider style={{ borderColor: '#303030', margin: '16px 0' }} />
        <Alert
          message={status?.otp_enabled
            ? "Gmail OTP is active. Every login requires email verification."
            : "Gmail OTP is disabled. Login only needs PIN + Password (+ 2FA if enabled)."}
          type={status?.otp_enabled ? 'success' : 'warning'}
          showIcon
          style={{
            background: status?.otp_enabled ? 'rgba(82,196,26,0.08)' : 'rgba(250,173,20,0.08)',
            border: `1px solid ${status?.otp_enabled ? 'rgba(82,196,26,0.2)' : 'rgba(250,173,20,0.2)'}`,
            borderRadius: 8
          }}
        />
      </Card>

      {/* ── 2FA Card ── */}
      <Card style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SafetyOutlined style={{ fontSize: 24, color: status?.two_fa_enabled ? '#52c41a' : '#848e9c' }} />
            <div>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Google Authenticator (2FA)</Text>
              <div><Text style={{ color: '#848e9c', fontSize: 13 }}>TOTP-based 2FA for maximum security</Text></div>
            </div>
          </div>
          <Tag
            color={status?.two_fa_enabled ? 'green' : 'orange'}
            style={{ fontSize: 13, padding: '4px 12px', borderRadius: 8 }}
          >
            {status?.two_fa_enabled
              ? <><CheckCircleOutlined /> Active</>
              : <><CloseCircleOutlined /> Not Active</>}
          </Tag>
        </div>

        {!status?.two_fa_enabled && step === 'idle' && (
          <div>
            <Alert
              message="2FA is not enabled. Enable it for maximum account security."
              type="warning" showIcon
              style={{ background: 'rgba(250,173,20,0.08)', border: '1px solid rgba(250,173,20,0.2)', borderRadius: 8, marginBottom: 16 }}
            />
            <Button
              type="primary" icon={<QrcodeOutlined />}
              loading={actionLoading} onClick={handleSetup} size="large"
              style={{ background: 'linear-gradient(135deg, #1890ff, #096dd9)', border: 'none', borderRadius: 8, height: 44, fontWeight: 600 }}
            >
              Setup Google Authenticator
            </Button>
          </div>
        )}

        {!status?.two_fa_enabled && step === 'verify' && qrData && (
          <div>
            <Alert
              message="Scan QR code with Google Authenticator, then enter the 6-digit code."
              type="info" showIcon
              style={{ background: 'rgba(24,144,255,0.08)', border: '1px solid rgba(24,144,255,0.2)', borderRadius: 8, marginBottom: 20 }}
            />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 12 }}>
                <img src={qrData} alt="QR Code" style={{ width: 180, height: 180 }} />
              </div>
            </div>
            <div style={{ background: '#0b0e11', border: '1px solid #303030', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
              <Text style={{ color: '#848e9c', fontSize: 12 }}>Manual entry key:</Text>
              <div>
                <Text copyable style={{ color: '#f0b90b', fontSize: 13, fontFamily: 'monospace' }}>{secret}</Text>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text style={{ color: '#848e9c', fontSize: 13, display: 'block', marginBottom: 8 }}>
                Enter 6-digit code from Google Authenticator:
              </Text>
              <Input
                prefix={<KeyOutlined style={{ color: '#4a6fa5' }} />}
                placeholder="6-digit code" maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                onPressEnter={handleEnable}
                size="large" style={inputStyle}
              />
            </div>
            <Space>
              <Button
                type="primary" icon={<CheckCircleOutlined />}
                loading={actionLoading} onClick={handleEnable} size="large"
                style={{ background: 'linear-gradient(135deg, #52c41a, #389e0d)', border: 'none', borderRadius: 8, height: 44, fontWeight: 600 }}
              >
                Verify & Enable 2FA
              </Button>
              <Button onClick={() => { setStep('idle'); setQrData(null); setTotpCode(''); }} size="large" style={{ borderRadius: 8, height: 44 }}>
                Cancel
              </Button>
            </Space>
          </div>
        )}

        {status?.two_fa_enabled && (
          <div>
            <Alert
              message="2FA is active. Your account is protected with Google Authenticator."
              type="success" showIcon
              style={{ background: 'rgba(82,196,26,0.08)', border: '1px solid rgba(82,196,26,0.2)', borderRadius: 8, marginBottom: 16 }}
            />
            <Button
              danger icon={<CloseCircleOutlined />}
              onClick={() => setDisableModal(true)} size="large"
              style={{ borderRadius: 8, height: 44, fontWeight: 600 }}
            >
              Disable 2FA
            </Button>
          </div>
        )}
      </Card>

      {/* ── PIN Change Card ── */}
      <Card style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LockOutlined style={{ fontSize: 24, color: '#f0b90b' }} />
            <div>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Security PIN</Text>
              <div><Text style={{ color: '#848e9c', fontSize: 13 }}>8-digit PIN — first step of admin login</Text></div>
            </div>
          </div>
          <Button
            icon={<EditOutlined />}
            onClick={() => setPinModal(true)}
            size="large"
            style={{ borderRadius: 8, height: 44, fontWeight: 600, borderColor: '#f0b90b', color: '#f0b90b' }}
          >
            Change PIN
          </Button>
        </div>
      </Card>

      {/* ── Login Security Flow ── */}
      <Card style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <LockOutlined style={{ fontSize: 24, color: '#f0b90b' }} />
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Login Security Flow</Text>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { step: '1', label: 'PIN Verification',  desc: '8-digit security PIN',   done: true },
            { step: '2', label: 'Email + Password',  desc: 'Admin credentials',       done: true },
            { step: '3', label: 'Gmail OTP',         desc: '6-digit email OTP',       done: status?.otp_enabled },
            { step: '4', label: 'Google 2FA',        desc: 'TOTP authenticator',      done: status?.two_fa_enabled },
          ].map(s => (
            <div key={s.step} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px',
              background: s.done ? 'rgba(82,196,26,0.06)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${s.done ? 'rgba(82,196,26,0.2)' : '#2b2f36'}`,
              borderRadius: 8
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: s.done ? '#52c41a' : '#303030',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0
              }}>
                {s.done ? '✓' : s.step}
              </div>
              <div style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{s.label}</Text>
                <div><Text style={{ color: '#848e9c', fontSize: 12 }}>{s.desc}</Text></div>
              </div>
              <Tag color={s.done ? 'green' : 'default'} style={{ borderRadius: 6 }}>
                {s.done ? 'Active' : 'Inactive'}
              </Tag>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Disable 2FA Modal ── */}
      <Modal
        title={<span style={{ color: '#fff' }}>🔓 Disable 2FA</span>}
        open={disableModal}
        onCancel={() => { setDisableModal(false); setDisableCode(''); }}
        footer={null}
        styles={{
          content: { background: '#1f1f1f', border: '1px solid #303030' },
          header: { background: '#1f1f1f', borderBottom: '1px solid #303030' }
        }}
      >
        <Alert
          message="Warning: Disabling 2FA reduces your account security!"
          type="warning" showIcon
          style={{ marginBottom: 20, background: 'rgba(250,173,20,0.1)', border: '1px solid rgba(250,173,20,0.2)', borderRadius: 8 }}
        />
        <Text style={{ color: '#848e9c', display: 'block', marginBottom: 12 }}>
          Enter current Google Authenticator code to confirm:
        </Text>
        <Input
          placeholder="6-digit TOTP code" maxLength={6}
          value={disableCode}
          onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
          size="large" style={{ ...inputStyle, marginBottom: 16 }}
        />
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={() => { setDisableModal(false); setDisableCode(''); }}>Cancel</Button>
          <Button danger loading={actionLoading} onClick={handleDisable} style={{ fontWeight: 600 }}>
            Confirm Disable
          </Button>
        </Space>
      </Modal>

      {/* ── Change PIN Modal ── */}
      <Modal
        title={<span style={{ color: '#fff' }}>🔑 Change Security PIN</span>}
        open={pinModal}
        onCancel={resetPinModal}
        footer={null}
        styles={{
          content: { background: '#1f1f1f', border: '1px solid #303030' },
          header: { background: '#1f1f1f', borderBottom: '1px solid #303030' }
        }}
      >
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: s < pinStep ? '#52c41a' : s === pinStep ? '#1890ff' : '#303030',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff'
              }}>
                {s < pinStep ? '✓' : s}
              </div>
              <Text style={{ color: s === pinStep ? '#fff' : '#4a6fa5', fontSize: 12 }}>
                {s === 1 ? 'Verify PIN' : 'Verify OTP'}
              </Text>
              {s < 2 && <div style={{ width: 24, height: 2, background: pinStep > s ? '#52c41a' : '#303030', borderRadius: 2 }} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {pinStep === 1 && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <Text style={{ color: '#848e9c', fontSize: 13, display: 'block', marginBottom: 6 }}>Current PIN:</Text>
              <Input.Password
                placeholder="Current 8-digit PIN" maxLength={8}
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                size="large"
                style={{ background: '#0b0e11', border: '1px solid #303030', color: '#fff' }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <Text style={{ color: '#848e9c', fontSize: 13, display: 'block', marginBottom: 6 }}>New PIN:</Text>
              <Input.Password
                placeholder="New 8-digit PIN" maxLength={8}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                size="large"
                style={{ background: '#0b0e11', border: '1px solid #303030', color: '#fff' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <Text style={{ color: '#848e9c', fontSize: 13, display: 'block', marginBottom: 6 }}>Confirm New PIN:</Text>
              <Input.Password
                placeholder="Confirm new PIN" maxLength={8}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                size="large"
                style={{ background: '#0b0e11', border: '1px solid #303030', color: '#fff' }}
                onPressEnter={handlePinStep1}
              />
            </div>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={resetPinModal}>Cancel</Button>
              <Button
                type="primary" loading={pinLoading} onClick={handlePinStep1}
                style={{ background: 'linear-gradient(135deg, #1890ff, #096dd9)', border: 'none', fontWeight: 600 }}
              >
                Verify & Send OTP →
              </Button>
            </Space>
          </div>
        )}

        {/* Step 2 */}
        {pinStep === 2 && (
          <div>
            <Alert
              message={<>OTP sent to <strong style={{ color: '#1890ff' }}>{pinEmailHint}</strong></>}
              type="info" showIcon
              style={{ background: 'rgba(24,144,255,0.08)', border: '1px solid rgba(24,144,255,0.2)', borderRadius: 8, marginBottom: 20 }}
            />
            <Text style={{ color: '#848e9c', fontSize: 13, display: 'block', marginBottom: 8 }}>
              Enter 6-digit OTP from email:
            </Text>
            <Input
              placeholder="6-digit OTP" maxLength={6}
              value={pinOtp}
              onChange={e => setPinOtp(e.target.value.replace(/\D/g, ''))}
              size="large"
              style={{ ...inputStyle, marginBottom: 20 }}
              onPressEnter={handlePinStep2}
            />
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setPinStep(1)}>← Back</Button>
              <Button
                type="primary" loading={pinLoading} onClick={handlePinStep2}
                style={{ background: 'linear-gradient(135deg, #52c41a, #389e0d)', border: 'none', fontWeight: 600 }}
              >
                Confirm PIN Change ✓
              </Button>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}
