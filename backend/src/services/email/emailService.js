const nodemailer = require('nodemailer');

// Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Base template
const baseTemplate = (content, title = 'VDExchange') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0b0e11;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:20px 10px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#1e2026;border-radius:12px 12px 0 0;padding:24px;text-align:center;border-bottom:2px solid #f0b90b;">
            <h1 style="margin:0;color:#f0b90b;font-size:24px;">⚡ VDExchange</h1>
            <p style="margin:4px 0 0;color:#848e9c;font-size:12px;">Professional Crypto Exchange</p>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="background:#1e2026;padding:30px 24px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#2b2f36;border-radius:0 0 12px 12px;padding:16px 24px;text-align:center;">
            <p style="margin:0;color:#848e9c;font-size:11px;">
              © 2025 VDExchange. All rights reserved.<br>
              <a href="${process.env.FRONTEND_URL}" style="color:#f0b90b;text-decoration:none;">
                ${process.env.FRONTEND_URL}
              </a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

// Send email function
const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.GMAIL_FROM || 'VDExchange <noreply@vdexchange.com>',
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent: ${subject} → ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// ================================
// EMAIL TEMPLATES
// ================================

// 1. Welcome Email
const sendWelcomeEmail = async (user) => {
  const html = baseTemplate(`
    <h2 style="color:#fff;margin:0 0 16px;">Welcome to VDExchange! 🎉</h2>
    <p style="color:#ccc;line-height:1.6;">
      Hi <strong style="color:#f0b90b;">${user.email}</strong>,<br><br>
      Your account has been created successfully. You can now trade, deposit, and withdraw crypto on VDExchange.
    </p>
    <div style="background:#2b2f36;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="color:#848e9c;margin:0 0 8px;font-size:12px;">YOUR REFERRAL CODE</p>
      <p style="color:#f0b90b;font-size:24px;font-weight:bold;margin:0;letter-spacing:4px;">
        ${user.referral_code || 'N/A'}
      </p>
    </div>
    <p style="color:#ccc;font-size:13px;">Share your referral code and earn rewards!</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${process.env.FRONTEND_URL}" style="background:#f0b90b;color:#000;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        Start Trading →
      </a>
    </div>
  `, 'Welcome to VDExchange');
  return sendEmail({ to: user.email, subject: '🎉 Welcome to VDExchange!', html });
};

// 2. Deposit Received
const sendDepositEmail = async (user, deposit) => {
  const html = baseTemplate(`
    <h2 style="color:#0ecb81;margin:0 0 16px;">✅ Deposit Received!</h2>
    <p style="color:#ccc;">Your deposit has been confirmed and credited to your account.</p>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['Coin', deposit.symbol],
          ['Amount', '<strong style="color:#0ecb81;font-size:18px;">+' + parseFloat(deposit.amount).toFixed(6) + ' ' + deposit.symbol + '</strong>'],
          ['Network', deposit.network],
          ['TX Hash', '<span style="font-size:11px;color:#1890ff;">' + (deposit.txhash ? deposit.txhash.slice(0,20) + '...' + deposit.txhash.slice(-8) : 'N/A') + '</span>'],
          ['Time', new Date().toLocaleString()],
          ['Status', '<span style="color:#0ecb81;">✅ Completed</span>'],
        ].map(([k, v]) => `
          <tr>
            <td style="color:#848e9c;padding:6px 0;font-size:13px;">${k}</td>
            <td style="color:#fff;padding:6px 0;font-size:13px;text-align:right;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <div style="text-align:center;margin-top:20px;">
      <a href="${process.env.FRONTEND_URL}/trade" style="background:#0ecb81;color:#000;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        Trade Now →
      </a>
    </div>
  `, 'Deposit Received');
  return sendEmail({
    to: user.email,
    subject: '✅ Deposit Confirmed: ' + parseFloat(deposit.amount).toFixed(4) + ' ' + deposit.symbol,
    html
  });
};

// 3. Withdrawal Success
const sendWithdrawalEmail = async (user, withdrawal) => {
  const html = baseTemplate(`
    <h2 style="color:#f0b90b;margin:0 0 16px;">📤 Withdrawal Processed!</h2>
    <p style="color:#ccc;">Your withdrawal has been processed successfully.</p>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['Coin', withdrawal.symbol],
          ['Amount', '<strong style="color:#f0b90b;font-size:18px;">' + parseFloat(withdrawal.amount).toFixed(6) + ' ' + withdrawal.symbol + '</strong>'],
          ['Fee', parseFloat(withdrawal.fee || 0).toFixed(6) + ' ' + withdrawal.symbol],
          ['You Received', '<strong style="color:#0ecb81;">' + parseFloat(withdrawal.receive_amount || withdrawal.amount).toFixed(6) + ' ' + withdrawal.symbol + '</strong>'],
          ['To Address', '<span style="font-size:11px;color:#1890ff;">' + (withdrawal.to_address ? withdrawal.to_address.slice(0,16) + '...' + withdrawal.to_address.slice(-8) : 'N/A') + '</span>'],
          ['TX Hash', withdrawal.txhash ? '<span style="font-size:11px;color:#1890ff;">' + withdrawal.txhash.slice(0,16) + '...' + withdrawal.txhash.slice(-8) + '</span>' : 'Processing...'],
          ['Status', '<span style="color:#0ecb81;">✅ Completed</span>'],
        ].map(([k, v]) => `
          <tr>
            <td style="color:#848e9c;padding:6px 0;font-size:13px;">${k}</td>
            <td style="color:#fff;padding:6px 0;font-size:13px;text-align:right;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `, 'Withdrawal Processed');
  return sendEmail({
    to: user.email,
    subject: '📤 Withdrawal: ' + parseFloat(withdrawal.amount).toFixed(4) + ' ' + withdrawal.symbol + ' Sent',
    html
  });
};

// 4. Withdrawal Rejected
const sendWithdrawalRejectedEmail = async (user, withdrawal, reason) => {
  const html = baseTemplate(`
    <h2 style="color:#f6465d;margin:0 0 16px;">❌ Withdrawal Rejected</h2>
    <p style="color:#ccc;">Your withdrawal request has been rejected and the amount has been refunded to your account.</p>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['Amount', parseFloat(withdrawal.amount).toFixed(6) + ' ' + withdrawal.symbol],
          ['Reason', '<span style="color:#f6465d;">' + (reason || 'Rejected by admin') + '</span>'],
          ['Refunded', '<span style="color:#0ecb81;">✅ Yes - Back to your account</span>'],
        ].map(([k, v]) => `
          <tr>
            <td style="color:#848e9c;padding:6px 0;font-size:13px;">${k}</td>
            <td style="color:#fff;padding:6px 0;font-size:13px;text-align:right;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `, 'Withdrawal Rejected');
  return sendEmail({
    to: user.email,
    subject: '❌ Withdrawal Rejected - ' + parseFloat(withdrawal.amount).toFixed(4) + ' ' + withdrawal.symbol + ' Refunded',
    html
  });
};

// 5. KYC Status
const sendKYCEmail = async (user, status, reason = '') => {
  const isApproved = status === 'approved';
  const html = baseTemplate(`
    <h2 style="color:${isApproved ? '#0ecb81' : '#f6465d'};margin:0 0 16px;">
      ${isApproved ? '✅ KYC Approved!' : '❌ KYC Rejected'}
    </h2>
    <p style="color:#ccc;">
      ${isApproved
        ? 'Congratulations! Your identity verification has been approved.'
        : 'Your KYC submission was rejected. ' + (reason ? 'Reason: ' + reason : 'Please resubmit with correct documents.')}
    </p>
    <div style="text-align:center;margin-top:20px;">
      <a href="${process.env.FRONTEND_URL}/${isApproved ? 'trade' : 'kyc'}"
        style="background:${isApproved ? '#0ecb81' : '#f0b90b'};color:#000;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        ${isApproved ? 'Start Trading →' : 'Resubmit KYC →'}
      </a>
    </div>
  `, 'KYC Status Update');
  return sendEmail({
    to: user.email,
    subject: isApproved ? '✅ KYC Approved - Start Trading!' : '❌ KYC Rejected - Action Required',
    html
  });
};

// 6. New Login Alert (UPGRADED - IP + Device + Location)
const sendLoginAlertEmail = async (user, loginInfo = {}) => {
  const rows = [
    ['📍 IP Address', loginInfo.ip || 'Unknown'],
    ['📱 Device',     loginInfo.device || 'Unknown'],
    ['🌐 Browser',    loginInfo.browser || 'Unknown'],
    ['💻 OS',         loginInfo.os || 'Unknown'],
    ['🌍 Location',   [loginInfo.city, loginInfo.country].filter(Boolean).join(', ') || 'Unknown'],
    ['🕒 Time',       loginInfo.time || new Date().toLocaleString()],
  ];

  const html = baseTemplate(`
    <h2 style="color:#f0b90b;margin:0 0 16px;">🔐 New Login Detected</h2>
    <p style="color:#ccc;margin:0 0 20px;">
      A new login was detected on your VDExchange account.
    </p>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${rows.map(([k, v]) => `
          <tr>
            <td style="color:#848e9c;padding:8px 0;border-bottom:1px solid #1e2026;font-size:13px;width:40%;">${k}</td>
            <td style="color:#eaecef;padding:8px 0;border-bottom:1px solid #1e2026;font-size:13px;text-align:right;font-weight:600;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <div style="background:#f6465d15;border:1px solid #f6465d40;border-radius:8px;padding:14px;margin-top:16px;">
      <p style="color:#f6465d;margin:0;font-size:13px;font-weight:600;">
        ⚠️ If this wasn't you, please change your password immediately and enable 2FA.
      </p>
    </div>
  `, 'New Login Alert');

  if (!user?.email) return;
  return sendEmail({
    to: user.email,
    subject: '🔐 New Login Alert - VDExchange',
    html
  });
};

// 7. Password Changed
const sendPasswordChangedEmail = async (user) => {
  const html = baseTemplate(`
    <h2 style="color:#f0b90b;margin:0 0 16px;">🔑 Password Changed</h2>
    <p style="color:#ccc;">Your VDExchange account password has been changed successfully.</p>
    <div style="background:#f6465d15;border:1px solid #f6465d30;border-radius:8px;padding:12px;margin:16px 0;">
      <p style="color:#f6465d;margin:0;font-size:13px;">
        ⚠️ If you didn't make this change, please contact support immediately!
      </p>
    </div>
    <p style="color:#848e9c;font-size:12px;">Time: ${new Date().toLocaleString()}</p>
  `, 'Password Changed');
  return sendEmail({
    to: user.email,
    subject: '🔑 Password Changed - VDExchange',
    html
  });
};

// 8. Forgot Password OTP
const sendForgotPasswordEmail = async (user, otp) => {
  const html = baseTemplate(`
    <h2 style="color:#fff;margin:0 0 16px;">🔐 Password Reset OTP</h2>
    <p style="color:#ccc;">Use the OTP below to reset your password. Valid for 10 minutes.</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="background:#2b2f36;border-radius:12px;padding:24px;display:inline-block;">
        <p style="color:#848e9c;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Your OTP Code</p>
        <p style="color:#f0b90b;font-size:40px;font-weight:bold;margin:0;letter-spacing:12px;">${otp}</p>
        <p style="color:#848e9c;margin:8px 0 0;font-size:11px;">Valid for 10 minutes</p>
      </div>
    </div>
    <div style="background:#f6465d15;border:1px solid #f6465d30;border-radius:8px;padding:12px;">
      <p style="color:#f6465d;margin:0;font-size:12px;">
        ⚠️ Never share this OTP with anyone. VDExchange will never ask for your OTP.
      </p>
    </div>
  `, 'Password Reset OTP');
  return sendEmail({
    to: user.email,
    subject: '🔐 OTP: ' + otp + ' - Reset Your VDExchange Password',
    html
  });
};

// 9. Large Withdrawal Admin Alert
const sendLargeWithdrawalAlert = async (withdrawal) => {
  const adminEmail = process.env.GMAIL_USER;
  const html = baseTemplate(`
    <h2 style="color:#f6465d;margin:0 0 16px;">⚠️ Large Withdrawal Alert!</h2>
    <p style="color:#ccc;">A large withdrawal request requires your attention.</p>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['User', withdrawal.email],
          ['Amount', '<strong style="color:#f6465d;font-size:18px;">' + parseFloat(withdrawal.amount).toFixed(6) + ' ' + withdrawal.symbol + '</strong>'],
          ['To Address', (withdrawal.to_address ? withdrawal.to_address.slice(0,16) + '...' : 'N/A')],
          ['Network', withdrawal.network_name],
          ['TX ID', withdrawal.tx_id],
          ['Time', new Date().toLocaleString()],
        ].map(([k, v]) => `
          <tr>
            <td style="color:#848e9c;padding:6px 0;font-size:13px;">${k}</td>
            <td style="color:#fff;padding:6px 0;font-size:13px;text-align:right;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <div style="text-align:center;margin-top:20px;">
      <a href="http://${process.env.SERVER_IP || '84.247.139.193'}:4006/withdrawals"
        style="background:#f6465d;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        Review Withdrawal →
      </a>
    </div>
  `, 'Large Withdrawal Alert');
  return sendEmail({
    to: adminEmail,
    subject: '⚠️ ALERT: Large Withdrawal ' + parseFloat(withdrawal.amount).toFixed(2) + ' ' + withdrawal.symbol,
    html
  });
};

// 10. Bulk email
const sendBulkEmail = async (users, subject, content) => {
  const results = [];
  for (const user of users) {
    const html = baseTemplate(`
      <h2 style="color:#fff;margin:0 0 16px;">${subject}</h2>
      <div style="color:#ccc;line-height:1.8;">${content}</div>
      <div style="text-align:center;margin-top:24px;">
        <a href="${process.env.FRONTEND_URL}" style="background:#f0b90b;color:#000;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
          Visit VDExchange →
        </a>
      </div>
    `);
    const result = await sendEmail({ to: user.email, subject, html });
    results.push({ email: user.email, ...result });
    await new Promise(r => setTimeout(r, 100));
  }
  return results;
};

// 11. Test email
const sendTestEmail = async (to) => {
  return sendEmail({
    to,
    subject: '✅ VDExchange Email Test',
    html: baseTemplate(`
      <h2 style="color:#0ecb81;">✅ Email Working!</h2>
      <p style="color:#ccc;">Your VDExchange email system is configured correctly.</p>
      <p style="color:#848e9c;font-size:12px;">Sent at: ${new Date().toLocaleString()}</p>
    `)
  });
};

// 12. OTP Email
const sendOTPEmail = async (user, otp, type = 'login') => {
  const typeLabels = {
    login:      'Login Verification',
    register:   'Email Verification',
    withdrawal: 'Withdrawal Confirmation',
    bind_phone: 'Phone Binding'
  };
  const label = typeLabels[type] || 'Verification';

  const html = baseTemplate(`
    <h2 style="color:#eaecef;margin:0 0 16px;">Your ${label} Code</h2>
    <p style="color:#848e9c;margin:0 0 24px;line-height:1.6;">
      Use the following OTP to complete your ${label.toLowerCase()}.
      This code expires in <strong style="color:#f0b90b;">5 minutes</strong>.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;background:#0b0e11;border:2px solid #f0b90b;border-radius:12px;padding:16px 40px;">
        <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#f0b90b;">${otp}</span>
      </div>
    </div>
    <p style="color:#848e9c;font-size:13px;text-align:center;margin:16px 0 0;">
      Never share this code with anyone. VDExchange will never ask for your OTP.
    </p>
    <div style="margin:20px 0 0;padding:12px;background:#2b2f36;border-radius:8px;border-left:3px solid #f6465d;">
      <p style="margin:0;color:#848e9c;font-size:12px;">
        ⚠️ If you didn't request this, please secure your account immediately.
      </p>
    </div>
  `, label + ' - VDExchange');

  await transporter.sendMail({
    from:    '"VDExchange" <' + process.env.GMAIL_USER + '>',
    to:      user.email,
    subject: otp + ' is your VDExchange ' + label + ' code',
    html,
  });
};


// ================================
// 13. Trade Executed Email
// ================================
const sendTradeEmail = async (user, trade) => {
  const isBuy    = trade.side === 'buy';
  const color    = isBuy ? '#0ecb81' : '#f6465d';
  const icon     = isBuy ? '📈' : '📉';
  const action   = isBuy ? 'Bought' : 'Sold';

  const html = baseTemplate(`
    <h2 style="color:${color};margin:0 0 16px;">${icon} Trade ${action}!</h2>
    <p style="color:#ccc;">Your trade has been executed successfully on VDExchange.</p>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['Pair',        `<strong style="color:#f0b90b;">${trade.symbol}</strong>`],
          ['Side',        `<strong style="color:${color};">${action.toUpperCase()}</strong>`],
          ['Quantity',    `<strong style="color:#fff;">${parseFloat(trade.qty||0).toFixed(6)} ${trade.base_symbol}</strong>`],
          ['Price',       `${parseFloat(trade.price||0).toFixed(4)} USDT`],
          ['Total Value', `<strong style="color:${color};">${parseFloat(trade.total||0).toFixed(2)} USDT</strong>`],
          ['Fee',         `${parseFloat(trade.fee||0).toFixed(6)} ${trade.fee_symbol||'USDT'}`],
          ['Order ID',    `<span style="font-size:11px;color:#848e9c;">${trade.order_id||'N/A'}</span>`],
          ['Time',        new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})],
        ].map(([k,v]) => `
          <tr>
            <td style="color:#848e9c;padding:6px 0;font-size:13px;">${k}</td>
            <td style="color:#fff;padding:6px 0;font-size:13px;text-align:right;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <div style="text-align:center;margin-top:20px;">
      <a href="${process.env.FRONTEND_URL}/orders" style="background:#f0b90b;color:#000;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        View Orders →
      </a>
    </div>
  `, 'Trade Executed');

  return sendEmail({
    to:      user.email,
    subject: `${icon} ${action} ${parseFloat(trade.qty||0).toFixed(4)} ${trade.base_symbol} @ ${parseFloat(trade.price||0).toFixed(4)} USDT`,
    html
  });
};

// ================================
// 14. Order Cancelled Email
// ================================
const sendOrderCancelEmail = async (user, order) => {
  const html = baseTemplate(`
    <h2 style="color:#f6465d;margin:0 0 16px;">❌ Order Cancelled</h2>
    <p style="color:#ccc;">Your order has been cancelled and funds have been refunded.</p>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['Pair',     `<strong style="color:#f0b90b;">${order.symbol}</strong>`],
          ['Side',     order.side?.toUpperCase()],
          ['Quantity', `${parseFloat(order.quantity||0).toFixed(6)}`],
          ['Price',    order.order_type === 'market' ? 'Market' : `${parseFloat(order.price||0).toFixed(4)} USDT`],
          ['Order ID', `<span style="font-size:11px;color:#848e9c;">${order.order_id||'N/A'}</span>`],
          ['Status',   '<span style="color:#f6465d;">Cancelled</span>'],
          ['Time',     new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})],
        ].map(([k,v]) => `
          <tr>
            <td style="color:#848e9c;padding:6px 0;font-size:13px;">${k}</td>
            <td style="color:#fff;padding:6px 0;font-size:13px;text-align:right;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <div style="padding:12px;background:#2b2f36;border-radius:8px;border-left:3px solid #0ecb81;margin-top:16px;">
      <p style="margin:0;color:#848e9c;font-size:12px;">✅ Funds have been refunded to your spot wallet.</p>
    </div>
  `, 'Order Cancelled');

  return sendEmail({
    to:      user.email,
    subject: `❌ Order Cancelled: ${order.side?.toUpperCase()} ${order.symbol}`,
    html
  });
};

// ================================
// 15. Security Alert Email
// ================================
const sendSecurityAlertEmail = async (user, alertInfo) => {
  const html = baseTemplate(`
    <h2 style="color:#f6465d;margin:0 0 16px;">🔐 Security Alert</h2>
    <p style="color:#ccc;">A security change was made to your VDExchange account.</p>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['Action',  `<strong style="color:#f0b90b;">${alertInfo.action||'Security Change'}</strong>`],
          ['IP',      alertInfo.ip||'Unknown'],
          ['Device',  alertInfo.device||'Unknown'],
          ['Time',    new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})],
        ].map(([k,v]) => `
          <tr>
            <td style="color:#848e9c;padding:6px 0;font-size:13px;">${k}</td>
            <td style="color:#fff;padding:6px 0;font-size:13px;text-align:right;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <div style="padding:12px;background:#2b2f36;border-radius:8px;border-left:3px solid #f6465d;margin-top:16px;">
      <p style="margin:0;color:#f6465d;font-size:13px;font-weight:bold;">
        ⚠️ Withdrawals are locked for 24 hours for your security.
      </p>
      <p style="margin:8px 0 0;color:#848e9c;font-size:12px;">
        If you did not make this change, please contact support immediately.
      </p>
    </div>
    <div style="text-align:center;margin-top:20px;">
      <a href="${process.env.FRONTEND_URL}/profile/security" 
         style="background:#f6465d;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        Secure My Account →
      </a>
    </div>
  `, 'Security Alert');

  return sendEmail({
    to:      user.email,
    subject: `🔐 Security Alert: ${alertInfo.action||'Account Change'} - VDExchange`,
    html
  });
};

// ================================
// 16. Withdrawal Locked Email
// ================================
const sendWithdrawLockedEmail = async (user, reason) => {
  const html = baseTemplate(`
    <h2 style="color:#f0b90b;margin:0 0 16px;">🔒 Withdrawals Temporarily Locked</h2>
    <p style="color:#ccc;">Your withdrawals have been temporarily locked for security.</p>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['Reason',       `<span style="color:#f0b90b;">${reason||'Security change detected'}</span>`],
          ['Lock Duration','24 hours'],
          ['Locked At',    new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})],
          ['Unlocks At',   new Date(Date.now()+24*60*60*1000).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})],
        ].map(([k,v]) => `
          <tr>
            <td style="color:#848e9c;padding:6px 0;font-size:13px;">${k}</td>
            <td style="color:#fff;padding:6px 0;font-size:13px;text-align:right;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <div style="padding:12px;background:#2b2f36;border-radius:8px;border-left:3px solid #f0b90b;">
      <p style="margin:0;color:#848e9c;font-size:12px;">
        This is a standard security measure. Trading and deposits are not affected.
        If you did not make any changes, please contact support.
      </p>
    </div>
  `, 'Withdrawals Locked');

  return sendEmail({
    to:      user.email,
    subject: '🔒 VDExchange: Withdrawals Locked for 24 Hours',
    html
  });
};

// ================================
// 17. VIP Upgrade Email
// ================================
const sendVipUpgradeEmail = async (user, vipInfo) => {
  const html = baseTemplate(`
    <h2 style="color:#f0b90b;margin:0 0 16px;">👑 VIP Level Upgraded!</h2>
    <p style="color:#ccc;">Congratulations! Your VIP level has been upgraded on VDExchange.</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f0b90b,#d48806);border-radius:16px;padding:20px 40px;">
        <div style="color:#000;font-size:14px;font-weight:600;">YOUR NEW LEVEL</div>
        <div style="color:#000;font-size:40px;font-weight:800;">VIP ${vipInfo.new_level||0}</div>
      </div>
    </div>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['Previous Level', `VIP ${vipInfo.old_level||0}`],
          ['New Level',      `<strong style="color:#f0b90b;">VIP ${vipInfo.new_level||0}</strong>`],
          ['Maker Fee',      `${vipInfo.maker_fee||'N/A'}`],
          ['Taker Fee',      `${vipInfo.taker_fee||'N/A'}`],
          ['Upgraded At',    new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})],
        ].map(([k,v]) => `
          <tr>
            <td style="color:#848e9c;padding:6px 0;font-size:13px;">${k}</td>
            <td style="color:#fff;padding:6px 0;font-size:13px;text-align:right;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <div style="text-align:center;margin-top:20px;">
      <a href="${process.env.FRONTEND_URL}/trade" 
         style="background:#f0b90b;color:#000;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        Start Trading →
      </a>
    </div>
  `, 'VIP Upgrade');

  return sendEmail({
    to:      user.email,
    subject: `👑 Congratulations! You are now VIP ${vipInfo.new_level} on VDExchange`,
    html
  });
};

// ================================
// 18. Referral Bonus Email
// ================================
const sendReferralEmail = async (user, refInfo) => {
  const html = baseTemplate(`
    <h2 style="color:#0ecb81;margin:0 0 16px;">🎉 Referral Bonus!</h2>
    <p style="color:#ccc;">Someone just joined VDExchange using your referral code!</p>
    <div style="background:#2b2f36;border-radius:8px;padding:20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['New Member',    `<strong style="color:#f0b90b;">${refInfo.referee_email||'New User'}</strong>`],
          ['Your Code',     user.referral_code||'N/A'],
          ['Commission',    `<strong style="color:#0ecb81;">${refInfo.commission_rate||'40'}% of trading fees</strong>`],
          ['Joined At',     new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})],
        ].map(([k,v]) => `
          <tr>
            <td style="color:#848e9c;padding:6px 0;font-size:13px;">${k}</td>
            <td style="color:#fff;padding:6px 0;font-size:13px;text-align:right;">${v}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    <div style="padding:12px;background:#2b2f36;border-radius:8px;border-left:3px solid #0ecb81;">
      <p style="margin:0;color:#848e9c;font-size:12px;">
        You will earn commission on every trade your referral makes. Keep sharing!
      </p>
    </div>
    <div style="text-align:center;margin-top:20px;">
      <a href="${process.env.FRONTEND_URL}/referral" 
         style="background:#0ecb81;color:#000;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        View Referrals →
      </a>
    </div>
  `, 'Referral Bonus');

  return sendEmail({
    to:      user.email,
    subject: '🎉 New Referral: Someone joined VDExchange using your code!',
    html
  });
};


module.exports = {
  sendEmail, sendWelcomeEmail, sendDepositEmail,
  sendWithdrawalEmail, sendWithdrawalRejectedEmail,
  sendKYCEmail, sendLoginAlertEmail, sendPasswordChangedEmail,
  sendForgotPasswordEmail, sendLargeWithdrawalAlert,
  sendBulkEmail, sendTestEmail, sendOTPEmail,
  sendTradeEmail, sendOrderCancelEmail, sendSecurityAlertEmail,
  sendWithdrawLockedEmail, sendVipUpgradeEmail, sendReferralEmail
};
