const cron = require('node-cron');
const { updatePricesFromBinance, updatePricesFromCoingecko } = require('../controllers/market.controller');

// priceUpdater.js →
// Background job hai - Binance se har 30s
// aur CoinGecko se har 5 min prices update
// karta hai automatically

const startPriceUpdater = () => {
  console.log('🔄 Price updater started');

  // Immediately run
  updatePricesFromBinance();
  updatePricesFromCoingecko();

  // Binance - har 30 second
  cron.schedule('*/30 * * * * *', async () => {
    await updatePricesFromBinance();
  });

  // CoinGecko - har 5 minute (rate limit avoid)
  cron.schedule('*/5 * * * *', async () => {
    await updatePricesFromCoingecko();
  });
};

module.exports = { startPriceUpdater };
