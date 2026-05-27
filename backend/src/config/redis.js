const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err));

// Helper functions
const cache = {
  set: (key, value, ttlSeconds) =>
    redis.set(key, JSON.stringify(value), 'EX', ttlSeconds),

  get: async (key) => {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  },

  del: (key) => redis.del(key),

  exists: (key) => redis.exists(key),
};

module.exports = { redis, cache };
