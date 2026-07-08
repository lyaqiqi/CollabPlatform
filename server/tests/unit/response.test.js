import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { success, fail } = require('../../src/utils/response');

function createResponseDouble() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('response utils', () => {
  it('success returns unified success payload', () => {
    const res = createResponseDouble();

    success(res, { ok: true }, 'done', 201);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      data: { ok: true },
      message: 'done',
    });
  });

  it('fail returns unified error payload', () => {
    const res = createResponseDouble();

    fail(res, 403, 40301, 'forbidden');

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      code: 40301,
      data: null,
      message: 'forbidden',
    });
  });
});
