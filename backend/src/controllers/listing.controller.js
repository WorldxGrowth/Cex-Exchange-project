const db = require('../config/database');
const { success, error } = require('../utils/response');

// listing.controller.js →
// Token listing apply karna, status check,
// admin approve/reject - exchange ka revenue
// source hai yeh feature

// APPLY for listing
const applyListing = async (req, res) => {
  try {
    const {
      token_name, token_symbol, contract_address, network_id,
      website, whitepaper_url, telegram, twitter,
      total_supply, description, listing_package,
      initial_price, listing_date,
      liquidity_token, liquidity_usdt
    } = req.body;

    if (!token_name || !token_symbol || !listing_package) {
      return error(res, 'token_name, token_symbol, listing_package required');
    }

    // Package fees
    const fees = { basic: 50000, premium: 100000, enterprise: 250000 };
    const listing_fee = fees[listing_package];
    if (!listing_fee) return error(res, 'Invalid package. Use: basic, premium, enterprise');

    // Check duplicate
    const existing = await db.query(
      "SELECT id FROM token_listings WHERE token_symbol = $1 AND status NOT IN ('rejected')",
      [token_symbol.toUpperCase()]
    );
    if (existing.rows.length > 0) {
      return error(res, 'Token already applied or listed');
    }

    const listing = await db.query(`
      INSERT INTO token_listings (
        applicant_user_id, token_name, token_symbol, contract_address,
        network_id, website, whitepaper_url, telegram, twitter,
        total_supply, description, listing_package, listing_fee,
        initial_price, listing_date, liquidity_token, liquidity_usdt,
        status, payment_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'pending','pending')
      RETURNING *
    `, [
      req.user.id, token_name, token_symbol.toUpperCase(),
      contract_address, network_id, website, whitepaper_url,
      telegram, twitter, total_supply, description,
      listing_package, listing_fee, initial_price,
      listing_date, liquidity_token, liquidity_usdt
    ]);

    return success(res, {
      listing: listing.rows[0],
      payment_instructions: {
        amount: listing_fee,
        currency: 'INR',
        message: `Pay ₹${listing_fee.toLocaleString()} to list your token`,
        contact: 'listing@vdexchange.com'
      }
    }, 'Listing application submitted!', 201);

  } catch (err) {
    console.error(err);
    return error(res, 'Failed to submit listing', 500);
  }
};

// GET my listings
const getMyListings = async (req, res) => {
  try {
    const listings = await db.query(`
      SELECT tl.*, n.name as network_name
      FROM token_listings tl
      LEFT JOIN networks n ON n.id = tl.network_id
      WHERE tl.applicant_user_id = $1
      ORDER BY tl.created_at DESC
    `, [req.user.id]);

    return success(res, listings.rows);
  } catch (err) {
    return error(res, 'Failed to get listings', 500);
  }
};

// GET listing status
const getListingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await db.query(`
      SELECT tl.*, n.name as network_name
      FROM token_listings tl
      LEFT JOIN networks n ON n.id = tl.network_id
      WHERE tl.id = $1 AND tl.applicant_user_id = $2
    `, [id, req.user.id]);

    if (!listing.rows[0]) return error(res, 'Listing not found', 404);
    return success(res, listing.rows[0]);
  } catch (err) {
    return error(res, 'Failed to get listing', 500);
  }
};

// GET listing packages info (public)
const getListingPackages = async (req, res) => {
  return success(res, {
    packages: [
      {
        id: 'basic',
        name: 'Basic Package',
        price: 50000,
        currency: 'INR',
        features: [
          'Token listing on VDExchange',
          'Order book setup',
          '30 days market making',
          'Trading volume generation',
          'Basic support'
        ],
        market_making_days: 30
      },
      {
        id: 'premium',
        name: 'Premium Package',
        price: 100000,
        currency: 'INR',
        features: [
          'Everything in Basic',
          '90 days market making',
          'Price target management',
          'Social media volume proof',
          'CoinGecko listing assistance',
          'Priority support'
        ],
        market_making_days: 90
      },
      {
        id: 'enterprise',
        name: 'Enterprise Package',
        price: 250000,
        currency: 'INR',
        features: [
          'Everything in Premium',
          '6 months market making',
          'Multi-exchange listing',
          'Dedicated market maker bot',
          'CMC listing assistance',
          '24/7 dedicated support',
          'Monthly report'
        ],
        market_making_days: 180
      }
    ]
  });
};

module.exports = { applyListing, getMyListings, getListingStatus, getListingPackages };
