
-- ==============================================
-- VDExchange - COMPLETE DATABASE SCHEMA
-- Market Standard | All Tables | Production Ready
-- ==============================================

-- ==================
-- 1. USERS & AUTH
-- ==================

CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  uid             VARCHAR(20) UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE,
  phone           VARCHAR(20) UNIQUE,
  alias           VARCHAR(50),
  password_hash   VARCHAR(255) NOT NULL,
  fund_password   VARCHAR(255),
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
  email_verified  BOOLEAN DEFAULT FALSE,
  phone_verified  BOOLEAN DEFAULT FALSE,
  kyc_level       SMALLINT DEFAULT 0,
  vip_level       SMALLINT DEFAULT 0,
  referral_code   VARCHAR(20) UNIQUE,
  referred_by     BIGINT,
  language        VARCHAR(10) DEFAULT 'en',
  currency        VARCHAR(10) DEFAULT 'USD',
  theme           VARCHAR(10) DEFAULT 'dark' CHECK (theme IN ('dark','light')),
  trend_color     VARCHAR(20) DEFAULT 'green_red' CHECK (trend_color IN ('green_red','red_green')),
  haptic_feedback BOOLEAN DEFAULT TRUE,
  app_icon        VARCHAR(50) DEFAULT 'default',
  push_notif      BOOLEAN DEFAULT TRUE,
  anti_phish_code VARCHAR(20),
  last_login_at   TIMESTAMP,
  last_login_ip   VARCHAR(45),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(512) UNIQUE NOT NULL,
  device_type VARCHAR(20) DEFAULT 'web' CHECK (device_type IN ('web','android','ios','api')),
  device_name VARCHAR(100),
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_history (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE CASCADE,
  ip_address  VARCHAR(45),
  device_type VARCHAR(50),
  user_agent  TEXT,
  location    VARCHAR(100),
  status      VARCHAR(20) CHECK (status IN ('success','failed','blocked')),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS two_factor_auth (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  method      VARCHAR(20) DEFAULT 'google_auth' CHECK (method IN ('google_auth','sms','email')),
  secret_key  VARCHAR(100),
  is_enabled  BOOLEAN DEFAULT FALSE,
  backup_codes TEXT[],
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_verifications (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT REFERENCES users(id) ON DELETE CASCADE,
  level            SMALLINT NOT NULL,
  full_name        VARCHAR(200),
  date_of_birth    DATE,
  nationality      VARCHAR(100),
  id_type          VARCHAR(30) CHECK (id_type IN ('passport','national_id','driving_license')),
  id_number        VARCHAR(50),
  id_front_url     VARCHAR(500),
  id_back_url      VARCHAR(500),
  selfie_url       VARCHAR(500),
  address          TEXT,
  status           VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  reviewed_by      BIGINT,
  reviewed_at      TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  action     VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  status     VARCHAR(20) CHECK (status IN ('success','failed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- User devices (Android/iOS FCM tokens)
CREATE TABLE IF NOT EXISTS user_devices (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT REFERENCES users(id) ON DELETE CASCADE,
  device_type  VARCHAR(20) CHECK (device_type IN ('android','ios','web')),
  device_name  VARCHAR(100),
  fcm_token    VARCHAR(500),
  app_version  VARCHAR(20),
  os_version   VARCHAR(20),
  is_active    BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMP DEFAULT NOW(),
  created_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)
);

-- ==================
-- 2. NETWORKS & COINS
-- ==================

CREATE TABLE IF NOT EXISTS networks (
  id           BIGSERIAL PRIMARY KEY,
  name         VARCHAR(100),
  short_name   VARCHAR(20),
  chain_id     INT,
  rpc_url      VARCHAR(500),
  explorer_url VARCHAR(500),
  logo_url     VARCHAR(500),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coins (
  id                BIGSERIAL PRIMARY KEY,
  symbol            VARCHAR(20) UNIQUE NOT NULL,
  name              VARCHAR(100) NOT NULL,
  logo_url          VARCHAR(500),
  coin_type         VARCHAR(20) DEFAULT 'erc20' CHECK (coin_type IN ('native','erc20','bep20','trc20','custom')),
  contract_address  VARCHAR(200),
  decimals          SMALLINT DEFAULT 18,
  network_id        BIGINT REFERENCES networks(id),
  is_active         BOOLEAN DEFAULT TRUE,
  is_deposit        BOOLEAN DEFAULT TRUE,
  is_withdraw       BOOLEAN DEFAULT TRUE,
  is_tradeable      BOOLEAN DEFAULT TRUE,
  min_deposit       DECIMAL(36,18) DEFAULT 0,
  min_withdraw      DECIMAL(36,18) DEFAULT 0,
  withdraw_fee      DECIMAL(36,18) DEFAULT 0,
  withdraw_fee_type VARCHAR(20) DEFAULT 'fixed' CHECK (withdraw_fee_type IN ('fixed','percentage')),
  confirmations     SMALLINT DEFAULT 12,
  price_source      VARCHAR(20) DEFAULT 'binance' CHECK (price_source IN ('binance','coingecko','custom','vdswap')),
  price_symbol      VARCHAR(30),
  sort_order        INT DEFAULT 0,
  listed_at         TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 3. WALLETS & BALANCES
-- ==================

CREATE TABLE IF NOT EXISTS user_wallets (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
  coin_id         BIGINT REFERENCES coins(id),
  network_id      BIGINT REFERENCES networks(id),
  address         VARCHAR(200),
  private_key_enc TEXT,
  hd_path         VARCHAR(100),
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, coin_id, network_id)
);

CREATE TABLE IF NOT EXISTS balances (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT REFERENCES users(id) ON DELETE CASCADE,
  coin_id      BIGINT REFERENCES coins(id),
  account_type VARCHAR(20) DEFAULT 'spot' CHECK (account_type IN ('spot','futures','funding','earn')),
  available    DECIMAL(36,18) DEFAULT 0,
  locked       DECIMAL(36,18) DEFAULT 0,
  updated_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, coin_id, account_type)
);

-- ==================
-- 4. DEPOSITS & WITHDRAWALS
-- ==================

CREATE TABLE IF NOT EXISTS deposits (
  id                     BIGSERIAL PRIMARY KEY,
  user_id                BIGINT REFERENCES users(id),
  coin_id                BIGINT REFERENCES coins(id),
  network_id             BIGINT REFERENCES networks(id),
  txhash                 VARCHAR(200) UNIQUE,
  from_address           VARCHAR(200),
  to_address             VARCHAR(200),
  amount                 DECIMAL(36,18) NOT NULL,
  fee                    DECIMAL(36,18) DEFAULT 0,
  confirmations          INT DEFAULT 0,
  required_confirmations INT DEFAULT 12,
  status                 VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirming','completed','failed')),
  credited               BOOLEAN DEFAULT FALSE,
  credited_at            TIMESTAMP,
  created_at             TIMESTAMP DEFAULT NOW(),
  updated_at             TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id),
  coin_id         BIGINT REFERENCES coins(id),
  network_id      BIGINT REFERENCES networks(id),
  to_address      VARCHAR(200) NOT NULL,
  amount          DECIMAL(36,18) NOT NULL,
  fee             DECIMAL(36,18) DEFAULT 0,
  amount_received DECIMAL(36,18),
  txhash          VARCHAR(200),
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  admin_note      TEXT,
  ip_address      VARCHAR(45),
  two_fa_verified BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfers (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT REFERENCES users(id),
  coin_id      BIGINT REFERENCES coins(id),
  from_account VARCHAR(20) CHECK (from_account IN ('spot','futures','funding','earn')),
  to_account   VARCHAR(20) CHECK (to_account IN ('spot','futures','funding','earn')),
  amount       DECIMAL(36,18) NOT NULL,
  status       VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed','failed')),
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 5. TRADING PAIRS & ORDERS
-- ==================

CREATE TABLE IF NOT EXISTS trading_pairs (
  id              BIGSERIAL PRIMARY KEY,
  base_coin_id    BIGINT REFERENCES coins(id),
  quote_coin_id   BIGINT REFERENCES coins(id),
  symbol          VARCHAR(30) UNIQUE NOT NULL,
  min_order_qty   DECIMAL(36,18),
  max_order_qty   DECIMAL(36,18),
  min_order_value DECIMAL(36,18),
  price_precision SMALLINT DEFAULT 2,
  qty_precision   SMALLINT DEFAULT 6,
  maker_fee       DECIMAL(10,6) DEFAULT 0.001,
  taker_fee       DECIMAL(10,6) DEFAULT 0.001,
  is_active       BOOLEAN DEFAULT TRUE,
  listing_date    TIMESTAMP,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id              BIGSERIAL PRIMARY KEY,
  order_id        VARCHAR(50) UNIQUE NOT NULL,
  user_id         BIGINT REFERENCES users(id),
  pair_id         BIGINT REFERENCES trading_pairs(id),
  side            VARCHAR(10) NOT NULL CHECK (side IN ('buy','sell')),
  order_type      VARCHAR(20) CHECK (order_type IN ('limit','market','stop_limit','stop_market')),
  price           DECIMAL(36,18),
  quantity        DECIMAL(36,18) NOT NULL,
  filled_qty      DECIMAL(36,18) DEFAULT 0,
  remaining_qty   DECIMAL(36,18),
  total_value     DECIMAL(36,18),
  avg_fill_price  DECIMAL(36,18),
  fee             DECIMAL(36,18) DEFAULT 0,
  fee_coin_id     BIGINT REFERENCES coins(id),
  status          VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open','partially_filled','filled','cancelled','expired')),
  time_in_force   VARCHAR(10) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC','IOC','FOK')),
  stop_price      DECIMAL(36,18),
  client_order_id VARCHAR(100),
  source          VARCHAR(20) DEFAULT 'web' CHECK (source IN ('web','android','ios','api','bot')),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
  id            BIGSERIAL PRIMARY KEY,
  trade_id      VARCHAR(50) UNIQUE NOT NULL,
  pair_id       BIGINT REFERENCES trading_pairs(id),
  buy_order_id  BIGINT REFERENCES orders(id),
  sell_order_id BIGINT REFERENCES orders(id),
  buyer_id      BIGINT REFERENCES users(id),
  seller_id     BIGINT REFERENCES users(id),
  price         DECIMAL(36,18) NOT NULL,
  quantity      DECIMAL(36,18) NOT NULL,
  total_value   DECIMAL(36,18) NOT NULL,
  buyer_fee     DECIMAL(36,18) DEFAULT 0,
  seller_fee    DECIMAL(36,18) DEFAULT 0,
  is_maker_buy  BOOLEAN,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Watchlist
CREATE TABLE IF NOT EXISTS user_watchlist (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  pair_id    BIGINT REFERENCES trading_pairs(id),
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, pair_id)
);

-- ==================
-- 6. MARKET DATA
-- ==================

CREATE TABLE IF NOT EXISTS price_feeds (
  id         BIGSERIAL PRIMARY KEY,
  coin_id    BIGINT REFERENCES coins(id) UNIQUE,
  price_usdt DECIMAL(36,18),
  price_btc  DECIMAL(36,18),
  change_1h  DECIMAL(10,4),
  change_24h DECIMAL(10,4),
  change_7d  DECIMAL(10,4),
  volume_24h DECIMAL(36,2),
  market_cap DECIMAL(36,2),
  high_24h   DECIMAL(36,18),
  low_24h    DECIMAL(36,18),
  source     VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS klines (
  id         BIGSERIAL PRIMARY KEY,
  pair_id    BIGINT REFERENCES trading_pairs(id),
  interval   VARCHAR(10) CHECK (interval IN ('1m','5m','15m','30m','1h','4h','1d','1w')),
  open_time  TIMESTAMP NOT NULL,
  open       DECIMAL(36,18),
  high       DECIMAL(36,18),
  low        DECIMAL(36,18),
  close      DECIMAL(36,18),
  volume     DECIMAL(36,18),
  close_time TIMESTAMP,
  UNIQUE(pair_id, interval, open_time)
);

CREATE TABLE IF NOT EXISTS token_listings (
  id                BIGSERIAL PRIMARY KEY,
  applicant_user_id BIGINT REFERENCES users(id),
  token_name        VARCHAR(100) NOT NULL,
  token_symbol      VARCHAR(20) NOT NULL,
  token_logo_url    VARCHAR(500),
  contract_address  VARCHAR(200),
  network_id        BIGINT REFERENCES networks(id),
  website           VARCHAR(300),
  whitepaper_url    VARCHAR(300),
  telegram          VARCHAR(200),
  twitter           VARCHAR(200),
  total_supply      VARCHAR(50),
  description       TEXT,
  listing_package   VARCHAR(20) CHECK (listing_package IN ('basic','premium','enterprise')),
  listing_fee       DECIMAL(20,2),
  liquidity_token   DECIMAL(36,18),
  liquidity_usdt    DECIMAL(36,18),
  initial_price     DECIMAL(36,18),
  listing_date      TIMESTAMP,
  status            VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','reviewing','approved','rejected','live')),
  admin_notes       TEXT,
  payment_txhash    VARCHAR(200),
  payment_status    VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','confirmed')),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_making_bots (
  id                 BIGSERIAL PRIMARY KEY,
  pair_id            BIGINT REFERENCES trading_pairs(id),
  owner_user_id      BIGINT REFERENCES users(id),
  bot_user_id        BIGINT REFERENCES users(id),
  is_active          BOOLEAN DEFAULT TRUE,
  strategy           VARCHAR(20) DEFAULT 'spread' CHECK (strategy IN ('spread','ladder','trend')),
  min_price          DECIMAL(36,18),
  max_price          DECIMAL(36,18),
  spread_pct         DECIMAL(10,4) DEFAULT 2.0,
  order_qty_min      DECIMAL(36,18),
  order_qty_max      DECIMAL(36,18),
  interval_min       INT DEFAULT 60,
  interval_max       INT DEFAULT 300,
  total_token_budget DECIMAL(36,18),
  total_usdt_budget  DECIMAL(36,18),
  used_token         DECIMAL(36,18) DEFAULT 0,
  used_usdt          DECIMAL(36,18) DEFAULT 0,
  expires_at         TIMESTAMP,
  created_at         TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 7. FUTURES
-- ==================

CREATE TABLE IF NOT EXISTS futures_pairs (
  id                 BIGSERIAL PRIMARY KEY,
  symbol             VARCHAR(30) UNIQUE,
  base_coin_id       BIGINT REFERENCES coins(id),
  contract_type      VARCHAR(20) DEFAULT 'perpetual' CHECK (contract_type IN ('perpetual','quarterly')),
  tick_size          DECIMAL(36,18),
  lot_size           DECIMAL(36,18),
  max_leverage       SMALLINT DEFAULT 100,
  maintenance_margin DECIMAL(10,6) DEFAULT 0.005,
  initial_margin     DECIMAL(10,6) DEFAULT 0.01,
  funding_interval   INT DEFAULT 8,
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS futures_positions (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT REFERENCES users(id),
  pair_id           BIGINT REFERENCES futures_pairs(id),
  side              VARCHAR(10) CHECK (side IN ('long','short')),
  margin_type       VARCHAR(20) CHECK (margin_type IN ('isolated','cross')),
  leverage          SMALLINT,
  entry_price       DECIMAL(36,18),
  mark_price        DECIMAL(36,18),
  quantity          DECIMAL(36,18),
  margin            DECIMAL(36,18),
  unrealized_pnl    DECIMAL(36,18),
  realized_pnl      DECIMAL(36,18) DEFAULT 0,
  take_profit       DECIMAL(36,18),
  stop_loss         DECIMAL(36,18),
  liquidation_price DECIMAL(36,18),
  status            VARCHAR(20) CHECK (status IN ('open','closed','liquidated')),
  opened_at         TIMESTAMP DEFAULT NOW(),
  closed_at         TIMESTAMP
);

CREATE TABLE IF NOT EXISTS funding_rates (
  id           BIGSERIAL PRIMARY KEY,
  pair_id      BIGINT REFERENCES futures_pairs(id),
  rate         DECIMAL(20,10),
  next_funding TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 8. P2P
-- ==================

CREATE TABLE IF NOT EXISTS p2p_payment_methods (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT REFERENCES users(id) ON DELETE CASCADE,
  method_type  VARCHAR(50),
  account_name VARCHAR(200),
  account_no   VARCHAR(100),
  upi_id       VARCHAR(100),
  bank_name    VARCHAR(100),
  ifsc_code    VARCHAR(20),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS p2p_ads (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id),
  ad_type         VARCHAR(10) CHECK (ad_type IN ('buy','sell')),
  coin_id         BIGINT REFERENCES coins(id),
  fiat_currency   VARCHAR(10) DEFAULT 'INR',
  price           DECIMAL(20,4),
  price_type      VARCHAR(20) CHECK (price_type IN ('fixed','floating')),
  float_premium   DECIMAL(10,4),
  min_order_fiat  DECIMAL(20,2),
  max_order_fiat  DECIMAL(20,2),
  available_qty   DECIMAL(36,18),
  payment_methods JSONB,
  time_limit      INT DEFAULT 15,
  terms           TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS p2p_orders (
  id             BIGSERIAL PRIMARY KEY,
  order_no       VARCHAR(30) UNIQUE,
  ad_id          BIGINT REFERENCES p2p_ads(id),
  buyer_id       BIGINT REFERENCES users(id),
  seller_id      BIGINT REFERENCES users(id),
  coin_id        BIGINT REFERENCES coins(id),
  fiat_amount    DECIMAL(20,2),
  crypto_amount  DECIMAL(36,18),
  price          DECIMAL(20,4),
  payment_method VARCHAR(50),
  status         VARCHAR(20) CHECK (status IN ('pending','paid','released','disputed','cancelled')),
  paid_at        TIMESTAMP,
  released_at    TIMESTAMP,
  expires_at     TIMESTAMP,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS p2p_chat (
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT REFERENCES p2p_orders(id),
  sender_id  BIGINT REFERENCES users(id),
  message    TEXT,
  file_url   VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 9. STAKING & EARN
-- ==================

CREATE TABLE IF NOT EXISTS earn_products (
  id           BIGSERIAL PRIMARY KEY,
  coin_id      BIGINT REFERENCES coins(id),
  product_type VARCHAR(20) CHECK (product_type IN ('flexible','fixed','auto')),
  name         VARCHAR(200),
  apy          DECIMAL(10,4),
  min_amount   DECIMAL(36,18),
  max_amount   DECIMAL(36,18),
  lock_days    INT DEFAULT 0,
  total_cap    DECIMAL(36,18),
  subscribed   DECIMAL(36,18) DEFAULT 0,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS earn_subscriptions (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT REFERENCES users(id),
  product_id       BIGINT REFERENCES earn_products(id),
  amount           DECIMAL(36,18),
  accrued_interest DECIMAL(36,18) DEFAULT 0,
  status           VARCHAR(20) CHECK (status IN ('active','redeemed','expired')),
  start_date       DATE,
  end_date         DATE,
  last_interest_at TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 10. REFERRAL & AFFILIATE
-- ==================

CREATE TABLE IF NOT EXISTS referral_commissions (
  id              BIGSERIAL PRIMARY KEY,
  referrer_id     BIGINT REFERENCES users(id),
  referee_id      BIGINT REFERENCES users(id),
  source_type     VARCHAR(20) CHECK (source_type IN ('spot_fee','futures_fee','deposit')),
  source_trade_id BIGINT,
  commission_rate DECIMAL(10,4),
  commission_usdt DECIMAL(36,18),
  coin_id         BIGINT REFERENCES coins(id),
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at         TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_accounts (
  id                      BIGSERIAL PRIMARY KEY,
  user_id                 BIGINT REFERENCES users(id) UNIQUE,
  tier                    VARCHAR(20) CHECK (tier IN ('basic','premium','master')),
  spot_commission_rate    DECIMAL(10,4) DEFAULT 0.40,
  futures_commission_rate DECIMAL(10,4) DEFAULT 0.40,
  total_earned            DECIMAL(36,18) DEFAULT 0,
  total_referrals         INT DEFAULT 0,
  payment_address         VARCHAR(200),
  approved_at             TIMESTAMP,
  created_at              TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 11. VIP
-- ==================

CREATE TABLE IF NOT EXISTS vip_levels (
  id                   BIGSERIAL PRIMARY KEY,
  level                SMALLINT UNIQUE,
  name                 VARCHAR(50),
  required_volume_30d  DECIMAL(36,2),
  spot_maker_fee       DECIMAL(10,6),
  spot_taker_fee       DECIMAL(10,6),
  futures_maker_fee    DECIMAL(10,6),
  futures_taker_fee    DECIMAL(10,6),
  withdraw_limit_daily DECIMAL(36,2),
  benefits             JSONB
);

CREATE TABLE IF NOT EXISTS vip_history (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id),
  from_level SMALLINT,
  to_level   SMALLINT,
  reason     VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 12. NOTIFICATIONS
-- ==================

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50),
  title      VARCHAR(200),
  message    TEXT,
  data       JSONB,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_alerts (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT REFERENCES users(id) ON DELETE CASCADE,
  coin_id      BIGINT REFERENCES coins(id),
  condition    VARCHAR(10) CHECK (condition IN ('above','below')),
  target_price DECIMAL(36,18),
  is_triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 13. API KEYS
-- ==================

CREATE TABLE IF NOT EXISTS api_keys (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT REFERENCES users(id) ON DELETE CASCADE,
  key_name     VARCHAR(100),
  api_key      VARCHAR(100) UNIQUE NOT NULL,
  secret_key   VARCHAR(200) NOT NULL,
  permissions  JSONB,
  ip_whitelist TEXT[],
  is_active    BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP,
  expires_at   TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 14. COPY TRADING
-- ==================

CREATE TABLE IF NOT EXISTS copy_traders (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT REFERENCES users(id) UNIQUE,
  display_name     VARCHAR(100),
  avatar_url       VARCHAR(500),
  bio              TEXT,
  total_pnl_pct    DECIMAL(10,4),
  win_rate         DECIMAL(10,4),
  max_drawdown     DECIMAL(10,4),
  followers_count  INT DEFAULT 0,
  aum_usdt         DECIMAL(36,2),
  min_copy_usdt    DECIMAL(20,2),
  profit_share_pct DECIMAL(10,4) DEFAULT 10,
  is_visible       BOOLEAN DEFAULT TRUE,
  verified         BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS copy_subscriptions (
  id           BIGSERIAL PRIMARY KEY,
  follower_id  BIGINT REFERENCES users(id),
  trader_id    BIGINT REFERENCES copy_traders(id),
  copy_amount  DECIMAL(36,18),
  copy_ratio   DECIMAL(10,4),
  realized_pnl DECIMAL(36,18) DEFAULT 0,
  status       VARCHAR(20) CHECK (status IN ('active','paused','stopped')),
  started_at   TIMESTAMP DEFAULT NOW(),
  stopped_at   TIMESTAMP
);

-- ==================
-- 15. ADMIN
-- ==================

CREATE TABLE IF NOT EXISTS admin_users (
  id            BIGSERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE,
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  role          VARCHAR(30) DEFAULT 'admin' CHECK (role IN ('super_admin','admin','support','finance','compliance')),
  permissions   JSONB,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id         BIGSERIAL PRIMARY KEY,
  key        VARCHAR(100) UNIQUE NOT NULL,
  value      TEXT,
  type       VARCHAR(20) CHECK (type IN ('string','number','boolean','json')),
  category   VARCHAR(50),
  updated_by BIGINT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fee_rules (
  id         BIGSERIAL PRIMARY KEY,
  rule_type  VARCHAR(30) CHECK (rule_type IN ('spot_maker','spot_taker','withdraw','deposit')),
  coin_id    BIGINT REFERENCES coins(id),
  pair_id    BIGINT REFERENCES trading_pairs(id),
  vip_level  SMALLINT DEFAULT 0,
  fee_type   VARCHAR(20) CHECK (fee_type IN ('percentage','fixed')),
  fee_value  DECIMAL(20,10),
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id           BIGSERIAL PRIMARY KEY,
  title        VARCHAR(300),
  content      TEXT,
  type         VARCHAR(30) CHECK (type IN ('system','listing','maintenance','promotion','news')),
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  expires_at   TIMESTAMP,
  created_by   BIGINT,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 16. VOUCHERS & GIFTS
-- ==================

CREATE TABLE IF NOT EXISTS vouchers (
  id          BIGSERIAL PRIMARY KEY,
  code        VARCHAR(50) UNIQUE,
  type        VARCHAR(30) CHECK (type IN ('deposit_bonus','fee_discount','fixed_usdt')),
  value       DECIMAL(20,4),
  coin_id     BIGINT REFERENCES coins(id),
  min_deposit DECIMAL(36,18),
  max_uses    INT,
  used_count  INT DEFAULT 0,
  expires_at  TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_vouchers (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  voucher_id BIGINT REFERENCES vouchers(id),
  status     VARCHAR(20) CHECK (status IN ('active','used','expired')),
  used_at    TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================
-- 17. BANNERS & POPUPS (Mobile/Web)
-- ==================

CREATE TABLE IF NOT EXISTS banners (
  id          BIGSERIAL PRIMARY KEY,
  title       VARCHAR(200),
  image_url   VARCHAR(500) NOT NULL,
  link_url    VARCHAR(500),
  link_type   VARCHAR(30) CHECK (link_type IN ('external','internal','none')),
  position    VARCHAR(30) CHECK (position IN ('home_top','home_middle','trade_page','markets_page','wallet_page','login_page')),
  platform    VARCHAR(20) DEFAULT 'all' CHECK (platform IN ('all','web','android','ios')),
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  starts_at   TIMESTAMP,
  ends_at     TIMESTAMP,
  created_by  BIGINT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_popups (
  id           BIGSERIAL PRIMARY KEY,
  title        VARCHAR(200),
  content      TEXT,
  image_url    VARCHAR(500),
  button_text  VARCHAR(100),
  button_url   VARCHAR(500),
  popup_type   VARCHAR(30) CHECK (popup_type IN ('welcome','announcement','promotion','maintenance','force_update')),
  platform     VARCHAR(20) DEFAULT 'all' CHECK (platform IN ('all','web','android','ios')),
  show_once    BOOLEAN DEFAULT TRUE,
  is_active    BOOLEAN DEFAULT TRUE,
  starts_at    TIMESTAMP,
  ends_at      TIMESTAMP,
  created_by   BIGINT,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_popup_views (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  popup_id   BIGINT REFERENCES app_popups(id),
  viewed_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, popup_id)
);

-- App version control (Android force update)
CREATE TABLE IF NOT EXISTS app_versions (
  id              BIGSERIAL PRIMARY KEY,
  platform        VARCHAR(20) CHECK (platform IN ('android','ios')),
  version         VARCHAR(20) NOT NULL,
  version_code    INT,
  is_force_update BOOLEAN DEFAULT FALSE,
  update_message  TEXT,
  store_url       VARCHAR(500),
  release_notes   TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ==================
-- ALL INDEXES
-- ==================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_balances_user ON balances(user_id);
CREATE INDEX IF NOT EXISTS idx_balances_user_coin ON balances(user_id, coin_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_pair_status ON orders(pair_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_pair ON trades(pair_id);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_txhash ON deposits(txhash);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_klines_pair_interval ON klines(pair_id, interval, open_time DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_price_feeds_coin ON price_feeds(coin_id);
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active, position);
CREATE INDEX IF NOT EXISTS idx_devices_user ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);

SELECT '✅ VDExchange Complete Schema Deployed Successfully!' AS result;
