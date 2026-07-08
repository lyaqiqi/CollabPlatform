import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadServerApp } from '../helpers/serverTestUtils.js';

describe('health and auth api', () => {
  it('returns health status without authentication', async () => {
    const { app } = loadServerApp();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.time).toBeTypeOf('string');
  });

  it('rejects /api/me when token is missing', async () => {
    const { app } = loadServerApp();

    const response = await request(app).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(40101);
  });

  it('registers user with normalized email and trimmed username', async () => {
    const { app, prismaMock } = loadServerApp();

    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      user_id: 'user-1',
      username: 'Alice',
      email: 'alice@example.com',
      created_at: '2026-07-08T00:00:00.000Z',
    });

    const response = await request(app).post('/api/auth/register').send({
      username: '  Alice  ',
      email: '  ALICE@Example.com ',
      password: 'password123',
    });

    expect(response.status).toBe(201);
    expect(response.body.code).toBe(0);
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'Alice',
          email: 'alice@example.com',
        }),
      }),
    );
  });

  it('logs user in and returns access tokens', async () => {
    const { app, prismaMock } = loadServerApp();
    const passwordHash = await bcrypt.hash('password123', 10);

    prismaMock.user.findUnique.mockResolvedValue({
      user_id: 'user-1',
      username: 'Alice',
      email: 'alice@example.com',
      password_hash: passwordHash,
      status: 'active',
    });

    const response = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data.accessToken).toBeTypeOf('string');
    expect(response.body.data.refreshToken).toBeTypeOf('string');
    expect(response.body.data.user.username).toBe('Alice');
  });
});
