const crypto = require('crypto');

const generateUID = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

const generateReferralCode = () => {
  return 'REF_' + crypto.randomBytes(3).toString('hex').toUpperCase();
};

const generateOrderId = () => {
  return 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
};

const generateTradeId = () => {
  return 'TRD' + Date.now() + Math.floor(Math.random() * 1000);
};

const encrypt = (text) => {
  const key = Buffer.from(process.env.ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (text) => {
  const key = Buffer.from(process.env.ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = {
  generateUID,
  generateReferralCode,
  generateOrderId,
  generateTradeId,
  encrypt,
  decrypt
};
