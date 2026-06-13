const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const DOCUMENT_TYPE = 'Document';
const MAX_NAME_LENGTH = 128;

function toFolderDto(folder) {
  return {
    folder_id: folder.folder_id,
    owner_id: folder.owner_id,
    parent_id: folder.parent_id ?? null,
    name: folder.name,
    sort_order: folder.sort_order,
    created_at: folder.created_at,
    updated_at: folder.updated_at,
  };
}

function toTreeDocDto(item) {
  return {
    item_id: item.item_id,
    title: item.title,
    folder_id: item.folder_id ?? null,
    owner_id: item.owner_id,
    updated_at: item.updated_at,
  };
}

function normalizeName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Folder name is required');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Folder name is too long');
  }
  return trimmed;
}

async function assertFolderOwner(folderId, userId) {
  const folder = await prisma.folder.findUnique({ where: { folder_id: folderId } });
  if (!folder) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, 'Folder not found');
  }
  if (folder.owner_id !== userId) {
    throw new AppError(403, AppError.CODES.FORBIDDEN, 'No access to this folder');
  }
  return folder;
}

/**
 * Validates that moving folderId under nextParentId would not create a cycle.
 *
 * Uses a single findMany to load all of the user's folders into memory, then
 * walks the parent chain in-memory — avoiding the N+1 findUnique pattern the
 * previous implementation used for deep trees.
 */
async function assertNoCycle(folderId, nextParentId, userId) {
  if (!nextParentId) return;
  if (nextParentId === folderId) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Cannot move a folder into itself');
  }

  // One query: load all folders owned by this user
  const allFolders = await prisma.folder.findMany({
    where: { owner_id: userId },
    select: { folder_id: true, parent_id: true },
  });

  const parentMap = new Map(allFolders.map((f) => [f.folder_id, f.parent_id ?? null]));

  // Verify nextParentId actually exists and belongs to the user
  if (!parentMap.has(nextParentId)) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, 'Folder not found');
  }

  // Walk from nextParentId upward; if we ever hit folderId the move is cyclic
  let cursor = nextParentId;
  const visited = new Set();
  while (cursor) {
    if (cursor === folderId) {
      throw new AppError(
        400,
        AppError.CODES.BAD_REQUEST,
        'Cannot move a folder into its descendant',
      );
    }
    if (visited.has(cursor)) break; // guard against pre-existing cycle in data
    visited.add(cursor);
    cursor = parentMap.get(cursor) ?? null;
  }
}

/**
 * 给定一批用户 ID，拉取他们全部的文件夹。
 * 用于让协作者看到共享文档 owner 的完整文件夹树。
 */
async function fetchAllFoldersByOwners(ownerIds) {
  if (ownerIds.length === 0) return [];
  return prisma.folder.findMany({
    where: { owner_id: { in: ownerIds } },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
}

/**
 * 返回所有与 userId 拥有共同文档的协作者 user_id 列表。
 * 用于在文件夹/文档结构变更时通知相关用户刷新树。
 */
async function getDocumentCollaborators(userId) {
  // 用户 A 是文档 owner，找到所有被授权的协作者
  const asOwner = await prisma.permission.findMany({
    where: { item: { owner_id: userId, type: DOCUMENT_TYPE } },
    select: { user_id: true },
    distinct: ['user_id'],
  });

  // 用户 A 是协作者，找到文档 owner（可能也需要同步）
  const asCollaborator = await prisma.permission.findMany({
    where: { user_id: userId, item: { type: DOCUMENT_TYPE } },
    select: { item: { select: { owner_id: true } } },
  });

  const ids = new Set([
    ...asOwner.map((p) => p.user_id),
    ...asCollaborator.map((p) => p.item.owner_id),
  ]);
  ids.delete(userId); // 排除自身
  return [...ids];
}

/**
 * 返回单个文档的所有协作者 user_id（不含 owner 本身）。
 */
async function getItemCollaborators(itemId) {
  const perms = await prisma.permission.findMany({
    where: { item_id: itemId },
    select: { user_id: true },
    distinct: ['user_id'],
  });
  return perms.map((p) => p.user_id);
}

/**
 * 返回当前用户拥有的整棵文件夹树 + 其可访问的文档节点。
 *
 * 对于协作者（用户 B），会同时纳入共享文档 owner（用户 A）的全部文件夹，
 * 使 B 能看到 A 完整的文件夹组织结构（标记为只读）。
 */
async function getFolderTree(userId) {
  const [folders, ownedItems, sharedItems] = await Promise.all([
    prisma.folder.findMany({
      where: { owner_id: userId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    }),
    prisma.collaborativeItem.findMany({
      where: { type: DOCUMENT_TYPE, owner_id: userId },
      orderBy: { updated_at: 'desc' },
    }),
    prisma.collaborativeItem.findMany({
      where: { type: DOCUMENT_TYPE, permissions: { some: { user_id: userId } } },
      orderBy: { updated_at: 'desc' },
    }),
  ]);

  const merged = [...ownedItems, ...sharedItems];
  const deduped = Array.from(new Map(merged.map((item) => [item.item_id, item])).values());
  const ownFolderIds = new Set(folders.map((f) => f.folder_id));

  // 收集所有向 B 共享过文档的用户（即外部 owner），拉取他们的全部文件夹
  const externalOwnerIds = [
    ...new Set(
      sharedItems.map((item) => item.owner_id).filter((id) => id !== userId),
    ),
  ];
  const externalFolders = await fetchAllFoldersByOwners(externalOwnerIds);

  // 合并所有可访问的文件夹 ID，用于校验文档的 folder_id 是否有效
  const allFolderIds = new Set([
    ...ownFolderIds,
    ...externalFolders.map((f) => f.folder_id),
  ]);

  const documents = deduped.map((item) => {
    const dto = toTreeDocDto(item);
    // folder_id 只在文件夹确实可见时保留，否则视为未分类（置 null）
    if (dto.folder_id && !allFolderIds.has(dto.folder_id)) {
      dto.folder_id = null;
    }
    dto.shared = item.owner_id !== userId;
    return dto;
  });

  // 外部文件夹标记为 shared/readonly，前端据此屏蔽编辑操作
  const allFolders = [
    ...folders.map(toFolderDto),
    ...externalFolders
      .filter((f) => !ownFolderIds.has(f.folder_id))
      .map((f) => ({ ...toFolderDto(f), shared: true, readonly: true })),
  ];

  return { folders: allFolders, documents };
}

async function createFolder(userId, { name, parent_id }) {
  const folderName = normalizeName(name);
  if (parent_id) {
    await assertFolderOwner(parent_id, userId);
  }

  const folder = await prisma.folder.create({
    data: {
      folder_id: uuidv4(),
      owner_id: userId,
      parent_id: parent_id || null,
      name: folderName,
    },
  });

  return toFolderDto(folder);
}

async function updateFolder(userId, folderId, { name, parent_id, sort_order }) {
  await assertFolderOwner(folderId, userId);
  const data = {};

  if (name !== undefined) {
    data.name = normalizeName(name);
  }

  if (parent_id !== undefined) {
    const nextParentId = parent_id || null;
    await assertNoCycle(folderId, nextParentId, userId);
    data.parent_id = nextParentId;
  }

  if (sort_order !== undefined) {
    const order = Number(sort_order);
    if (!Number.isFinite(order)) {
      throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Invalid sort order');
    }
    data.sort_order = order;
  }

  const folder = await prisma.folder.update({
    where: { folder_id: folderId },
    data,
  });

  return toFolderDto(folder);
}

async function deleteFolder(userId, folderId) {
  await assertFolderOwner(folderId, userId);
  // 子文件夹随 onDelete: Cascade 连带删除；其下文档的 folder_id 由 onDelete: SetNull 退回未分类
  await prisma.folder.delete({ where: { folder_id: folderId } });
}

module.exports = {
  getFolderTree,
  createFolder,
  updateFolder,
  deleteFolder,
  assertFolderOwner,
  getDocumentCollaborators,
  getItemCollaborators,
};
