import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { signAccessToken, signRefreshToken, verifyToken } = require('../../src/utils/jwt');
const AppError = require('../../src/utils/AppError');

describe('jwt utils', () => {
  it('signs and verifies access token', () => {
    const token = signAccessToken({ userId: 'user-1' });
    const payload = verifyToken(token, 'access');

    expect(payload.userId).toBe('user-1');
    expect(payload.token_type).toBe('access');
  });

  it('signs and verifies refresh token', () => {
    const token = signRefreshToken({ userId: 'user-2' });
    const payload = verifyToken(token, 'refresh');

    expect(payload.userId).toBe('user-2');
    expect(payload.token_type).toBe('refresh');
  });

  it('rejects token with unexpected type', () => {
    const token = signRefreshToken({ userId: 'user-3' });

    try {
      verifyToken(token, 'access');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(AppError.CODES.UNAUTHORIZED);
      return;
    }

    throw new Error('expected verifyToken to throw');
  });
});
