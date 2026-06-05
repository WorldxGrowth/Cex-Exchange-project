const cron = require('node-cron');
const { updatePricesFromBinance, updatePricesFromCoingecko, updateCustomTokenStats } = require('../controllers/market.controller');

const startPriceUpdater = () => {
  console.log('🔄 Price updater started');

  // Immediately run all
  updatePricesFromBinance();
  updatePricesFromCoingecko();
  updateCustomTokenStats();

  // Binance - har 30 second
  cron.schedule('*/30 * * * * *', async () => {
    await updatePricesFromBinance();
  });

  // CoinGecko - har 5 minute
  cron.schedule('*/5 * * * *', async () => {
    await updatePricesFromCoingecko();
  });

  // Custom tokens (VDC etc) - har 1 minute
  cron.schedule('*/1 * * * *', async () => {
    await updateCustomTokenStats();
  });
};

module.exports = { startPriceUpdater };
