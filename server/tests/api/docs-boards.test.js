import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadServerApp, getServerRequire } from '../helpers/serverTestUtils.js';

const require = getServerRequire();

describe('docs and boards api', () => {
  it('creates document through protected endpoint and broadcasts tree update', async () => {
    const { app, prismaMock, socketMock } = loadServerApp();
    const { signAccessToken } = require('../../src/utils/jwt');

    prismaMock.collaborativeItem.create.mockResolvedValue({
      item_id: 'doc-1',
      type: 'Document',
      title: 'Test Doc',
      owner_id: 'user-1',
      is_public: false,
      folder_id: null,
      content_data: { yjs_state: null },
      created_at: '2026-07-08T00:00:00.000Z',
      updated_at: '2026-07-08T00:00:00.000Z',
    });

    const response = await request(app)
      .post('/api/docs')
      .set('Authorization', `Bearer ${signAccessToken({ userId: 'user-1' })}`)
      .send({ title: 'Test Doc' });

    expect(response.status).toBe(201);
    expect(response.body.code).toBe(0);
    expect(response.body.data.item_id).toBe('doc-1');
    expect(socketMock.broadcastToTreeRoom).toHaveBeenCalledWith(
      'user-1',
      'tree:doc-created',
      expect.objectContaining({
        doc: expect.objectContaining({ item_id: 'doc-1', title: 'Test Doc' }),
      }),
    );
  });

  it('restores board version and broadcasts room event', async () => {
    const { app, prismaMock, socketMock } = loadServerApp();
    const { signAccessToken } = require('../../src/utils/jwt');

    prismaMock.collaborativeItem.findUnique.mockResolvedValue({
      item_id: 'board-1',
      owner_id: 'user-1',
    });
    prismaMock.version.findUnique.mockResolvedValue({
      version_id: 'version-1',
      item_id: 'board-1',
      content_snapshot: {
        title: 'Recovered board',
        canvas: { objects: [{ id: 'rect-1' }] },
      },
    });
    prismaMock.collaborativeItem.update.mockResolvedValue({
      item_id: 'board-1',
      type: 'Whiteboard',
      owner_id: 'user-1',
      title: 'Recovered board',
      content_data: { canvas: { objects: [{ id: 'rect-1' }] } },
      created_at: '2026-07-08T00:00:00.000Z',
      updated_at: '2026-07-08T00:00:01.000Z',
    });

    const response = await request(app)
      .post('/api/boards/board-1/versions/version-1/restore')
      .set('Authorization', `Bearer ${signAccessToken({ userId: 'user-1' })}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data.title).toBe('Recovered board');
    expect(socketMock.broadcastToRoom).toHaveBeenCalledWith(
      'board-1',
      'board:version-restored',
      {
        itemId: 'board-1',
        restoredBy: 'user-1',
      },
    );
  });
});
