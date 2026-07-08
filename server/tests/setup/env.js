process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/collab_platform_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-deepseek-key';
