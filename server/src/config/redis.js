const Redis = require('ioredis');
const { REDIS_URL } = require('./env');

let redisClient = null;
let isRedisAvailable = false;

if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // 停止重试
        }
        return Math.min(times * 500, 2000);
      },
    });

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      console.log('[redis] 连接成功');
    });

    redisClient.on('error', (err) => {
      if (isRedisAvailable) {
        console.warn('[redis] 连接异常，降级为无缓存模式:', err.message);
      }
      isRedisAvailable = false;
    });

    redisClient.connect().catch((err) => {
      console.warn('[redis] 初始连接失败，降级为无缓存模式:', err.message);
    });
  } catch (err) {
    console.warn('[redis] 初始化失败，降级为无缓存模式:', err.message);
  }
} else {
  console.warn('[redis] REDIS_URL 未配置，降级为无缓存模式');
}

// 降级空操作客户端，保证业务代码不因 Redis 不可用而崩溃
const noop = () => Promise.resolve(null);
const noopClient = new Proxy(
  {},
  {
    get: () => noop,
  }
);

module.exports = {
  // 如果 Redis 可用则返回真实客户端，否则返回空操作客户端
  get redis() {
    return isRedisAvailable && redisClient ? redisClient : noopClient;
  },
  get isRedisAvailable() {
    return isRedisAvailable;
  },
};
