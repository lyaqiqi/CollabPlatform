import { createRequire } from 'node:module';
import { vi } from 'vitest';

const require = createRequire(import.meta.url);

const serverSrcSegment = `${require('node:path').sep}server${require('node:path').sep}src${require('node:path').sep}`;

export function createPrismaMock() {
  return {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    collaborativeItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    permission: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    version: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    folder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

export function createSocketMock() {
  return {
    initSocket: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    broadcastToRoom: vi.fn(),
    broadcastToTreeRoom: vi.fn(),
  };
}

export function clearServerModuleCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(serverSrcSegment)) {
      delete require.cache[key];
    }
  }
}

function mockResolvedModule(resolvedPath, exportsValue) {
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports: exportsValue,
  };
}

export function loadServerApp({ prismaMock = createPrismaMock(), socketMock = createSocketMock() } = {}) {
  clearServerModuleCache();
  mockResolvedModule(require.resolve('../../src/config/prisma'), prismaMock);
  mockResolvedModule(require.resolve('../../src/socket'), socketMock);
  const app = require('../../src/app');
  return { app, prismaMock, socketMock };
}

export function loadDocService({ prismaMock = createPrismaMock() } = {}) {
  clearServerModuleCache();
  mockResolvedModule(require.resolve('../../src/config/prisma'), prismaMock);
  const docService = require('../../src/services/doc.service');
  return { docService, prismaMock };
}

export function loadBoardService({ prismaMock = createPrismaMock() } = {}) {
  clearServerModuleCache();
  mockResolvedModule(require.resolve('../../src/config/prisma'), prismaMock);
  const boardService = require('../../src/services/board.service');
  return { boardService, prismaMock };
}

export function getServerRequire() {
  return require;
}
