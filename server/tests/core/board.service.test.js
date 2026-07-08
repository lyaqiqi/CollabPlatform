import { describe, expect, it } from 'vitest';
import { loadBoardService } from '../helpers/serverTestUtils.js';

describe('board service core behavior', () => {
  it('restores board snapshot canvas and title from version', async () => {
    const { boardService, prismaMock } = loadBoardService();

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
      title: 'Recovered board',
      content_data: { canvas: { objects: [{ id: 'rect-1' }] } },
    });

    const result = await boardService.restoreBoardVersion('user-1', 'board-1', 'version-1');

    expect(prismaMock.collaborativeItem.update).toHaveBeenCalledWith({
      where: { item_id: 'board-1' },
      data: {
        content_data: { canvas: { objects: [{ id: 'rect-1' }] } },
        title: 'Recovered board',
      },
    });
    expect(result.title).toBe('Recovered board');
  });

  it('rejects restore when selected version has no canvas snapshot', async () => {
    const { boardService, prismaMock } = loadBoardService();

    prismaMock.collaborativeItem.findUnique.mockResolvedValue({
      item_id: 'board-1',
      owner_id: 'user-1',
    });
    prismaMock.version.findUnique.mockResolvedValue({
      version_id: 'version-2',
      item_id: 'board-1',
      content_snapshot: {
        title: 'Missing canvas',
      },
    });

    try {
      await boardService.restoreBoardVersion('user-1', 'board-1', 'version-2');
    } catch (error) {
      expect(error.code).toBe(40001);
      return;
    }

    throw new Error('expected restoreBoardVersion to throw');
  });
});
