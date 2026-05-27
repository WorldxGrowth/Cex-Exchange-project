-- =============================================
-- SEED DATA - Networks, Coins, VIP, Admin
-- =============================================

-- NETWORKS
INSERT INTO networks (name, short_name, chain_id, rpc_url, explorer_url, logo_url, is_active) VALUES
('BNB Smart Chain', 'BSC', 56, 'https://bsc-dataseed.binance.org', 'https://bscscan.com', 'https://cryptologos.cc/logos/bnb-bnb-logo.png', true),
('Ethereum', 'ETH', 1, 'https://eth.llamarpc.com', 'https://etherscan.io', 'https://cryptologos.cc/logos/ethereum-eth-logo.png', true),
('Tron', 'TRX', 728126428, 'https://api.trongrid.io', 'https://tronscan.org', 'https://cryptologos.cc/logos/tron-trx-logo.png', true),
('VDChain', 'VDC', 882022, 'https://rpc.vdscan.io', 'https://vdscan.io', 'https://vdscan.io/logo.png', true)
ON CONFLICT DO NOTHING;

-- COINS
INSERT INTO coins (symbol, name, logo_url, coin_type, decimals, network_id, is_active, is_deposit, is_withdraw, is_tradeable, min_deposit, min_withdraw, withdraw_fee, confirmations, price_source, price_symbol, sort_order) VALUES
('USDT', 'Tether USD', 'https://cryptologos.cc/logos/tether-usdt-logo.png', 'bep20', 18, 1, true, true, true, true, 1, 5, 1, 15, 'binance', 'USDTUSDT', 1),
('BTC', 'Bitcoin', 'https://cryptologos.cc/logos/bitcoin-btc-logo.png', 'native', 8, 2, true, true, true, true, 0.0001, 0.001, 0.0001, 2, 'binance', 'BTCUSDT', 2),
('ETH', 'Ethereum', 'https://cryptologos.cc/logos/ethereum-eth-logo.png', 'native', 18, 2, true, true, true, true, 0.01, 0.05, 0.005, 12, 'binance', 'ETHUSDT', 3),
('BNB', 'BNB', 'https://cryptologos.cc/logos/bnb-bnb-logo.png', 'native', 18, 1, true, true, true, true, 0.01, 0.05, 0.001, 15, 'binance', 'BNBUSDT', 4),
('SOL', 'Solana', 'https://cryptologos.cc/logos/solana-sol-logo.png', 'native', 9, 2, true, true, true, true, 0.1, 0.5, 0.01, 1, 'binance', 'SOLUSDT', 5),
('XRP', 'XRP', 'https://cryptologos.cc/logos/xrp-xrp-logo.png', 'native', 6, 2, true, true, true, true, 1, 5, 0.5, 6, 'binance', 'XRPUSDT', 6),
('DOGE', 'Dogecoin', 'https://cryptologos.cc/logos/dogecoin-doge-logo.png', 'native', 8, 2, true, true, true, true, 10, 50, 5, 6, 'binance', 'DOGEUSDT', 7),
('TRX', 'TRON', 'https://cryptologos.cc/logos/tron-trx-logo.png', 'native', 6, 3, true, true, true, true, 10, 50, 1, 20, 'binance', 'TRXUSDT', 8),
('VDC', 'VDChain', 'https://vdscan.io/logo.png', 'native', 18, 4, true, true, true, true, 10, 50, 1, 10, 'custom', 'VDCUSDT', 9)
ON CONFLICT DO NOTHING;

-- TRADING PAIRS
INSERT INTO trading_pairs (base_coin_id, quote_coin_id, symbol, min_order_qty, min_order_value, price_precision, qty_precision, maker_fee, taker_fee, is_active, sort_order) VALUES
((SELECT id FROM coins WHERE symbol='BTC'), (SELECT id FROM coins WHERE symbol='USDT'), 'BTCUSDT', 0.00001, 1, 2, 6, 0.001, 0.001, true, 1),
((SELECT id FROM coins WHERE symbol='ETH'), (SELECT id FROM coins WHERE symbol='USDT'), 'ETHUSDT', 0.0001, 1, 2, 5, 0.001, 0.001, true, 2),
((SELECT id FROM coins WHERE symbol='BNB'), (SELECT id FROM coins WHERE symbol='USDT'), 'BNBUSDT', 0.001, 1, 2, 4, 0.001, 0.001, true, 3),
((SELECT id FROM coins WHERE symbol='SOL'), (SELECT id FROM coins WHERE symbol='USDT'), 'SOLUSDT', 0.01, 1, 2, 4, 0.001, 0.001, true, 4),
((SELECT id FROM coins WHERE symbol='XRP'), (SELECT id FROM coins WHERE symbol='USDT'), 'XRPUSDT', 0.1, 1, 4, 2, 0.001, 0.001, true, 5),
((SELECT id FROM coins WHERE symbol='DOGE'), (SELECT id FROM coins WHERE symbol='USDT'), 'DOGEUSDT', 1, 1, 6, 2, 0.001, 0.001, true, 6),
((SELECT id FROM coins WHERE symbol='TRX'), (SELECT id FROM coins WHERE symbol='USDT'), 'TRXUSDT', 1, 1, 6, 2, 0.001, 0.001, true, 7),
((SELECT id FROM coins WHERE symbol='VDC'), (SELECT id FROM coins WHERE symbol='USDT'), 'VDCUSDT', 1, 1, 6, 2, 0.001, 0.001, true, 8),
((SELECT id FROM coins WHERE symbol='BTC'), (SELECT id FROM coins WHERE symbol='USDT'), 'BTCUSDT', 0.00001, 1, 2, 6, 0.001, 0.001, true, 1)
ON CONFLICT DO NOTHING;

-- VIP LEVELS
INSERT INTO vip_levels (level, name, required_volume_30d, spot_maker_fee, spot_taker_fee, futures_maker_fee, futures_taker_fee, withdraw_limit_daily, benefits) VALUES
(0, 'VIP 0', 0,        0.001000, 0.001000, 0.000200, 0.000500, 100000,  '{"label":"Standard"}'),
(1, 'VIP 1', 10000,    0.000900, 0.000900, 0.000180, 0.000450, 200000,  '{"label":"VIP 1","perks":["Priority support"]}'),
(2, 'VIP 2', 50000,    0.000800, 0.000800, 0.000160, 0.000400, 500000,  '{"label":"VIP 2","perks":["Priority support","Fee discount"]}'),
(3, 'VIP 3', 200000,   0.000700, 0.000700, 0.000140, 0.000350, 1000000, '{"label":"VIP 3"}'),
(4, 'VIP 4', 500000,   0.000600, 0.000600, 0.000120, 0.000300, 2000000, '{"label":"VIP 4"}'),
(5, 'VIP 5', 1000000,  0.000500, 0.000500, 0.000100, 0.000250, 5000000, '{"label":"VIP 5"}')
ON CONFLICT (level) DO NOTHING;

-- SYSTEM SETTINGS
INSERT INTO system_settings (key, value, type, category) VALUES
('site_name',           'VDExchange',     'string',  'general'),
('site_logo',           '/logo.png',      'string',  'general'),
('maintenance_mode',    'false',          'boolean', 'general'),
('registration_open',   'true',           'boolean', 'general'),
('kyc_required',        'false',          'boolean', 'kyc'),
('withdraw_requires_kyc','true',          'boolean', 'kyc'),
('min_withdraw_usdt',   '5',             'number',  'finance'),
('default_maker_fee',   '0.001',         'number',  'trading'),
('default_taker_fee',   '0.001',         'number',  'trading'),
('referral_rate',       '0.40',          'number',  'referral'),
('deposit_enabled',     'true',          'boolean', 'finance'),
('withdraw_enabled',    'true',          'boolean', 'finance'),
('spot_trading_enabled','true',          'boolean', 'trading'),
('futures_enabled',     'true',          'boolean', 'trading'),
('p2p_enabled',         'true',          'boolean', 'trading'),
('support_email',       'support@vdexchange.com', 'string', 'contact'),
('telegram_link',       'https://t.me/vdexchange', 'string', 'social'),
('twitter_link',        'https://twitter.com/vdexchange', 'string', 'social')
ON CONFLICT (key) DO NOTHING;

-- ADMIN USER
INSERT INTO admin_users (username, email, password_hash, role, is_active) VALUES
('superadmin', 'admin@vdexchange.com', '$2a$12$placeholder_will_be_set_via_api', 'super_admin', true)
ON CONFLICT DO NOTHING;

SELECT '✅ Seed Data Inserted Successfully!' AS result;
