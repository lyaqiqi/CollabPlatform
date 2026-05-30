const { PrismaClient } = require('@prisma/client');

// 单例：避免开发热重载时重复创建连接
const prisma = global.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

module.exports = prisma;
