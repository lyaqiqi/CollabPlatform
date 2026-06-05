const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

async function getBoardRole({ userId, itemId }) {
  const item = await prisma.collaborativeItem.findUnique({
    where: { item_id: itemId },
    select: { item_id: true, owner_id: true },
  });
  if (!item) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, '白板不存在');
  }
  if (item.owner_id === userId) return { role: 'owner', item };

  const permission = await prisma.permission.findFirst({
    where: { user_id: userId, item_id: itemId },
    select: { role: true },
  });

  return { role: permission?.role || null, item };
}

async function assertBoardReadable({ userId, itemId }) {
  const { role } = await getBoardRole({ userId, itemId });
  if (!role) {
    throw new AppError(403, AppError.CODES.FORBIDDEN, '无权限访问该白板');
  }
}

async function assertBoardWritable({ userId, itemId }) {
  const { role } = await getBoardRole({ userId, itemId });
  if (role !== 'owner' && role !== 'editor') {
    throw new AppError(403, AppError.CODES.FORBIDDEN, '无权限编辑该白板');
  }
}

async function assertBoardOwner({ userId, itemId }) {
  const { role } = await getBoardRole({ userId, itemId });
  if (role !== 'owner') {
    throw new AppError(403, AppError.CODES.FORBIDDEN, '仅白板所有者可执行该操作');
  }
}

async function listBoards(userId) {
  const boards = await prisma.collaborativeItem.findMany({
    where: {
      type: 'Whiteboard',
      OR: [{ owner_id: userId }, { permissions: { some: { user_id: userId } } }],
    },
    orderBy: { updated_at: 'desc' },
    select: {
      item_id: true,
      type: true,
      owner_id: true,
      title: true,
      content_data: true,
      created_at: true,
      updated_at: true,
    },
  });
  return boards;
}

async function createBoard(userId, { title }) {
  const created = await prisma.collaborativeItem.create({
    data: {
      type: 'Whiteboard',
      owner_id: userId,
      title: (title || '未命名白板').slice(0, 256),
      content_data: { canvas: null },
      permissions: {
        create: [{ user_id: userId, role: 'owner' }],
      },
    },
    select: {
      item_id: true,
      type: true,
      owner_id: true,
      title: true,
      content_data: true,
      created_at: true,
      updated_at: true,
    },
  });
  return created;
}

async function getBoard(userId, itemId) {
  await assertBoardReadable({ userId, itemId });
  const board = await prisma.collaborativeItem.findUnique({
    where: { item_id: itemId },
    select: {
      item_id: true,
      type: true,
      owner_id: true,
      title: true,
      content_data: true,
      created_at: true,
      updated_at: true,
    },
  });
  if (!board || board.type !== 'Whiteboard') {
    throw new AppError(404, AppError.CODES.NOT_FOUND, '白板不存在');
  }
  return board;
}

async function updateBoard(userId, itemId, { title, content_data }) {
  await assertBoardWritable({ userId, itemId });
  const data = {};
  if (typeof title === 'string') data.title = title.slice(0, 256);
  if (typeof content_data !== 'undefined') data.content_data = content_data;
  if (!Object.keys(data).length) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '缺少可更新字段');
  }

  const updated = await prisma.collaborativeItem.update({
    where: { item_id: itemId },
    data,
    select: {
      item_id: true,
      type: true,
      owner_id: true,
      title: true,
      content_data: true,
      created_at: true,
      updated_at: true,
    },
  });
  if (updated.type !== 'Whiteboard') {
    throw new AppError(404, AppError.CODES.NOT_FOUND, '白板不存在');
  }
  return updated;
}

async function deleteBoard(userId, itemId) {
  await assertBoardOwner({ userId, itemId });
  const deleted = await prisma.collaborativeItem.delete({
    where: { item_id: itemId },
    select: { item_id: true },
  });
  return deleted;
}

function toVersionDto(version) {
  return {
    version_id: version.version_id,
    item_id: version.item_id,
    content_snapshot: version.content_snapshot,
    created_at: version.created_at,
  };
}

/** GET /api/boards/:id/versions */
async function listBoardVersions(userId, itemId) {
  await assertBoardReadable({ userId, itemId });
  const versions = await prisma.version.findMany({
    where: { item_id: itemId },
    orderBy: { created_at: 'desc' },
  });
  return versions.map(toVersionDto);
}

/** POST /api/boards/:id/versions */
async function createBoardVersion(userId, itemId, { content_snapshot }) {
  await assertBoardWritable({ userId, itemId });
  const snapshot = content_snapshot || { type: 'manual_checkpoint', created_by: userId };
  
  const version = await prisma.version.create({
    data: {
      item_id: itemId,
      content_snapshot: snapshot,
    },
  });
  
  // 只保留最近50条，删除旧的
  const oldVersions = await prisma.version.findMany({
    where: { item_id: itemId },
    orderBy: { created_at: 'desc' },
    skip: 50,
    select: { version_id: true },
  });
  if (oldVersions.length > 0) {
    await prisma.version.deleteMany({
      where: { version_id: { in: oldVersions.map(v => v.version_id) } },
    });
  }
  
  return toVersionDto(version);
}

/** POST /api/boards/:id/versions/:versionId/restore — Owner 可回滚 */
async function restoreBoardVersion(userId, itemId, versionId) {
  await assertBoardOwner({ userId, itemId });   // 仅 Owner 可回滚
  const version = await prisma.version.findUnique({ where: { version_id: versionId } });
  if (!version || version.item_id !== itemId) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, '版本快照不存在');
  }
  const snapshot = version.content_snapshot;
  if (!snapshot?.canvas) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '该版本没有可恢复的内容快照');
  }
  const updated = await prisma.collaborativeItem.update({
    where: { item_id: itemId },
    data: {
      content_data: { canvas: snapshot.canvas },
      ...(snapshot.title ? { title: snapshot.title } : {}),
    },
  });
  return updated;
}

module.exports = {
  listBoards,
  createBoard,
  getBoard,
  updateBoard,
  deleteBoard,
  listBoardVersions,
  createBoardVersion,
  restoreBoardVersion,
};