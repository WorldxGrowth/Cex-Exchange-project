const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./database');
const { generateTokens } = require('../utils/jwt');
const { generateUID, generateReferralCode } = require('../utils/helpers');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;
    const avatar = profile.photos?.[0]?.value;

    if (!email) return done(null, false, { message: 'No email from Google' });

    // Check existing user
    let user = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    if (user.rows.length === 0) {
      // New user - create account
      const uid = generateUID();
      const referralCode = generateReferralCode();
      const bcrypt = require('bcryptjs');
      const randomPass = await bcrypt.hash(Math.random().toString(36), 12);

      const newUser = await db.query(`
        INSERT INTO users (uid, email, full_name, avatar, password_hash, referral_code,
                          email_verified, status)
        VALUES ($1,$2,$3,$4,$5,$6,true,'active')
        RETURNING *
      `, [uid, email, name, avatar, randomPass, referralCode]);

      user = newUser;

      // Create wallets
      const coins = await db.query('SELECT id FROM coins WHERE is_active = true');
      const accounts = ['spot', 'futures', 'funding', 'earn'];
      for (const coin of coins.rows) {
        for (const account of accounts) {
          await db.query(`
            INSERT INTO balances (user_id, coin_id, account_type, available, locked)
            VALUES ($1,$2,$3,0,0) ON CONFLICT DO NOTHING
          `, [newUser.rows[0].id, coin.id, account]);
        }
      }
    }

    const userData = user.rows[0];
    const { accessToken: token } = generateTokens(userData.id);

    // Save session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(`
      INSERT INTO user_sessions (user_id, token, device_type, expires_at)
      VALUES ($1,$2,'web',$3)
    `, [userData.id, token, expiresAt]);

    return done(null, { user: userData, token });
  } catch (err) {
    return done(err);
  }
}));

module.exports = passport;
