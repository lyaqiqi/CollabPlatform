import { describe, expect, it } from 'vitest';
import { loadDocService } from '../helpers/serverTestUtils.js';

describe('doc service core behavior', () => {
  it('merges incoming content_data into persisted collaboration state', async () => {
    const { docService, prismaMock } = loadDocService();

    prismaMock.collaborativeItem.findUnique.mockResolvedValue({
      item_id: 'doc-1',
      type: 'Document',
      owner_id: 'user-1',
      title: 'Old title',
      is_public: false,
      folder_id: null,
      content_data: {
        yjs_state: 'old-state',
        canvas: { objects: [{ id: 'shape-1' }] },
      },
      created_at: '2026-07-08T00:00:00.000Z',
      updated_at: '2026-07-08T00:00:00.000Z',
      permissions: [],
    });
    prismaMock.collaborativeItem.update.mockResolvedValue({
      item_id: 'doc-1',
      type: 'Document',
      owner_id: 'user-1',
      title: 'Old title',
      is_public: false,
      folder_id: null,
      content_data: {
        yjs_state: 'new-state',
        canvas: { objects: [{ id: 'shape-1' }] },
      },
      created_at: '2026-07-08T00:00:00.000Z',
      updated_at: '2026-07-08T00:00:01.000Z',
    });

    const result = await docService.updateDoc('user-1', 'doc-1', {
      content_data: { yjs_state: 'new-state' },
    });

    expect(prismaMock.collaborativeItem.update).toHaveBeenCalledWith({
      where: { item_id: 'doc-1' },
      data: {
        content_data: {
          yjs_state: 'new-state',
          canvas: { objects: [{ id: 'shape-1' }] },
        },
      },
    });
    expect(result.content_data.yjs_state).toBe('new-state');
    expect(result.content_data.canvas).toEqual({ objects: [{ id: 'shape-1' }] });
    expect(result.feature_flags.presence).toBe(true);
  });

  it('rejects comment creation when selection range is invalid', async () => {
    const { docService, prismaMock } = loadDocService();

    prismaMock.collaborativeItem.findUnique.mockResolvedValue({
      item_id: 'doc-1',
      type: 'Document',
      owner_id: 'owner-1',
      permissions: [{ user_id: 'editor-1', role: 'editor' }],
    });

    await expect(
      docService.createDocComment('editor-1', 'doc-1', {
        content: 'Bad range',
        position: { from: 5, to: 5, selected_text: 'x' },
      }),
    ).rejects.toThrow('Invalid comment selection range');
  });
});
