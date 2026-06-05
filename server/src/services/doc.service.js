const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const DOCUMENT_TYPE = 'Document';
const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };
const MEMBER_ROLES = new Set(['viewer', 'editor']);

async function findDocument(itemId) {
  const item = await prisma.collaborativeItem.findUnique({
    where: { item_id: itemId },
    include: { permissions: true },
  });

  if (!item || item.type !== DOCUMENT_TYPE) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, 'Document not found');
  }

  return item;
}

function resolveRole(item, userId) {
  if (item.owner_id === userId) {
    return 'owner';
  }

  const permission = item.permissions.find((entry) => entry.user_id === userId);
  return permission?.role ?? null;
}

async function assertDocumentAccess(itemId, userId, minRole = 'viewer') {
  const item = await findDocument(itemId);
  const role = resolveRole(item, userId);

  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new AppError(403, AppError.CODES.FORBIDDEN, 'No access to this document');
  }

  return { item, role };
}

function toDocDto(item) {
  return {
    item_id: item.item_id,
    type: item.type,
    title: item.title,
    owner_id: item.owner_id,
    is_public: item.is_public,
    content_data: item.content_data,
    created_at: item.created_at,
    updated_at: item.updated_at,
    feature_flags: {
      comments: true,
      versions: true,
      permissions: true,
      presence: true,
    },
  };
}

function toCommentDto(comment) {
  return {
    comment_id: comment.comment_id,
    item_id: comment.item_id,
    author_id: comment.author_id,
    parent_id: comment.parent_id ?? null,
    content: comment.content,
    position: comment.position,
    is_resolved: comment.is_resolved,
    created_at: comment.created_at,
    author: comment.author
      ? {
          user_id: comment.author.user_id,
          username: comment.author.username,
          email: comment.author.email,
        }
      : null,
    replies: Array.isArray(comment.replies) ? comment.replies.map(toCommentDto) : [],
  };
}

function toVersionDto(version) {
  return {
    version_id: version.version_id,
    item_id: version.item_id,
    content_snapshot: version.content_snapshot,
    created_at: version.created_at,
  };
}

function toMemberDto(permission) {
  return {
    user_id: permission.user.user_id,
    username: permission.user.username,
    email: permission.user.email,
    role: permission.role,
  };
}

function mergeContentData(currentValue, nextValue) {
  const currentData =
    currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
      ? currentValue
      : {};
  const incomingData =
    nextValue && typeof nextValue === 'object' && !Array.isArray(nextValue) ? nextValue : {};

  return { ...currentData, ...incomingData };
}

async function listDocs(userId) {
  const [ownedItems, sharedItems] = await Promise.all([
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
  deduped.sort((left, right) => {
    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });

  return deduped.map(toDocDto);
}

async function createDoc(userId, { title }) {
  const normalizedTitle = typeof title === 'string' ? title.trim() : '';

  const item = await prisma.collaborativeItem.create({
    data: {
      item_id: uuidv4(),
      type: DOCUMENT_TYPE,
      owner_id: userId,
      title: normalizedTitle || 'Untitled Document',
      content_data: { yjs_state: null },
      permissions: {
        create: [{ user_id: userId, role: 'owner' }],
      },
    },
  });

  return toDocDto(item);
}

async function getDocById(userId, itemId) {
  const { item } = await assertDocumentAccess(itemId, userId, 'viewer');
  return toDocDto(item);
}

async function getDocSidebar(userId, itemId) {
  await assertDocumentAccess(itemId, userId, 'viewer');

  const [comments, versions, item] = await Promise.all([
    prisma.comment.findMany({
      where: { item_id: itemId, parent_id: null },
      orderBy: { created_at: 'desc' },
      include: {
        author: true,
        replies: {
          include: { author: true },
          orderBy: { created_at: 'asc' },
        },
      },
      take: 50,
    }),
    prisma.version.findMany({
      where: { item_id: itemId },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),
    prisma.collaborativeItem.findUnique({
      where: { item_id: itemId },
      include: {
        owner: true,
        permissions: {
          include: { user: true },
          orderBy: { role: 'desc' },
        },
      },
    }),
  ]);

  if (!item) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, 'Document not found');
  }

  const members = [
    item.owner
      ? {
          user_id: item.owner.user_id,
          username: item.owner.username,
          email: item.owner.email,
          role: 'owner',
        }
      : null,
    ...item.permissions
      .filter((permission) => permission.user_id !== item.owner_id)
      .map(toMemberDto),
  ].filter(Boolean);

  return {
    comments: comments.map(toCommentDto),
    versions: versions.map(toVersionDto),
    members,
    stats: {
      comment_count: comments.length,
      version_count: versions.length,
      member_count: members.length,
    },
  };
}

async function updateDoc(userId, itemId, { title, content_data }) {
  const { item } = await assertDocumentAccess(itemId, userId, 'editor');
  const data = {};

  if (title !== undefined) {
    const trimmed = String(title).trim();
    if (!trimmed) {
      throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Document title is required');
    }
    data.title = trimmed;
  }

  if (content_data !== undefined) {
    data.content_data = mergeContentData(item.content_data, content_data);
  }

  const updated = await prisma.collaborativeItem.update({
    where: { item_id: itemId },
    data,
  });

  return toDocDto(updated);
}

async function deleteDoc(userId, itemId) {
  await assertDocumentAccess(itemId, userId, 'owner');
  await prisma.collaborativeItem.delete({ where: { item_id: itemId } });
}

async function listDocComments(userId, itemId) {
  await assertDocumentAccess(itemId, userId, 'viewer');

  const comments = await prisma.comment.findMany({
    where: { item_id: itemId, parent_id: null },
    orderBy: { created_at: 'desc' },
    include: {
      author: true,
      replies: {
        include: { author: true },
        orderBy: { created_at: 'asc' },
      },
    },
  });

  return comments.map(toCommentDto);
}

async function createDocComment(userId, itemId, { content, position }) {
  await assertDocumentAccess(itemId, userId, 'editor');

  const trimmed = String(content || '').trim();
  if (!trimmed) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Comment content is required');
  }

  const from = Number(position?.from);
  const to = Number(position?.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to <= from) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Invalid comment selection range');
  }

  const comment = await prisma.comment.create({
    data: {
      item_id: itemId,
      author_id: userId,
      content: trimmed,
      position: {
        type: 'selection',
        from,
        to,
        selected_text: String(position?.selected_text || ''),
      },
    },
    include: {
      author: true,
      replies: { include: { author: true } },
    },
  });

  return toCommentDto(comment);
}

async function createCommentReply(userId, itemId, commentId, { content }) {
  await assertDocumentAccess(itemId, userId, 'editor');

  const trimmed = String(content || '').trim();
  if (!trimmed) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Reply content is required');
  }

  const parent = await prisma.comment.findUnique({ where: { comment_id: commentId } });
  if (!parent || parent.item_id !== itemId) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, 'Comment not found');
  }

  const reply = await prisma.comment.create({
    data: {
      item_id: itemId,
      author_id: userId,
      parent_id: commentId,
      content: trimmed,
      position: parent.position,
    },
    include: {
      author: true,
      replies: { include: { author: true } },
    },
  });

  return toCommentDto(reply);
}

async function resolveDocComment(userId, itemId, commentId, { is_resolved }) {
  await assertDocumentAccess(itemId, userId, 'editor');

  const comment = await prisma.comment.findUnique({ where: { comment_id: commentId } });
  if (!comment || comment.item_id !== itemId) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, 'Comment not found');
  }

  const updated = await prisma.comment.update({
    where: { comment_id: commentId },
    data: { is_resolved: Boolean(is_resolved) },
    include: {
      author: true,
      replies: { include: { author: true } },
    },
  });

  return toCommentDto(updated);
}

async function listDocVersions(userId, itemId) {
  await assertDocumentAccess(itemId, userId, 'viewer');

  const versions = await prisma.version.findMany({
    where: { item_id: itemId },
    orderBy: { created_at: 'desc' },
  });

  return versions.map(toVersionDto);
}

async function createDocVersion(userId, itemId, { content_snapshot }) {
  await assertDocumentAccess(itemId, userId, 'editor');

  const snapshot = content_snapshot || { type: 'manual_checkpoint', created_by: userId };
  const version = await prisma.version.create({
    data: {
      item_id: itemId,
      content_snapshot: snapshot,
    },
  });

  const oldVersions = await prisma.version.findMany({
    where: { item_id: itemId },
    orderBy: { created_at: 'desc' },
    skip: 50,
    select: { version_id: true },
  });

  if (oldVersions.length > 0) {
    await prisma.version.deleteMany({
      where: { version_id: { in: oldVersions.map((entry) => entry.version_id) } },
    });
  }

  return toVersionDto(version);
}

async function restoreDocVersion(userId, itemId, versionId) {
  await assertDocumentAccess(itemId, userId, 'editor');

  const version = await prisma.version.findUnique({ where: { version_id: versionId } });
  if (!version || version.item_id !== itemId) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, 'Version not found');
  }

  const snapshot = version.content_snapshot;
  if (!snapshot?.yjs_state) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Selected version cannot be restored');
  }

  const updated = await prisma.collaborativeItem.update({
    where: { item_id: itemId },
    data: {
      content_data: { yjs_state: snapshot.yjs_state },
      ...(snapshot.title ? { title: snapshot.title } : {}),
    },
  });

  return toDocDto(updated);
}

async function listDocMembers(userId, itemId) {
  const { item } = await assertDocumentAccess(itemId, userId, 'viewer');

  const owner = await prisma.user.findUnique({
    where: { user_id: item.owner_id },
    select: { user_id: true, username: true, email: true },
  });
  const permissions = await prisma.permission.findMany({
    where: { item_id: itemId },
    include: { user: true },
  });

  return [
    owner ? { ...owner, role: 'owner' } : null,
    ...permissions
      .filter((permission) => permission.user_id !== item.owner_id)
      .map(toMemberDto),
  ].filter(Boolean);
}

async function inviteDocMember(userId, itemId, { email_or_username, role }) {
  await assertDocumentAccess(itemId, userId, 'owner');

  const normalizedRole = String(role || '').toLowerCase();
  if (!MEMBER_ROLES.has(normalizedRole)) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Role must be viewer or editor');
  }

  const query = String(email_or_username || '').trim();
  if (!query) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Member identifier is required');
  }

  const target = await prisma.user.findFirst({
    where: { OR: [{ email: query }, { username: query }] },
    select: { user_id: true, username: true, email: true },
  });
  if (!target) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, 'User not found');
  }

  const item = await prisma.collaborativeItem.findUnique({
    where: { item_id: itemId },
    select: { owner_id: true },
  });
  if (item?.owner_id === target.user_id) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Owner already has full access');
  }

  const member = await prisma.permission.upsert({
    where: { user_id_item_id: { user_id: target.user_id, item_id: itemId } },
    update: { role: normalizedRole },
    create: { user_id: target.user_id, item_id: itemId, role: normalizedRole },
    include: { user: true },
  });

  return toMemberDto(member);
}

async function removeDocMember(userId, itemId, targetUserId) {
  await assertDocumentAccess(itemId, userId, 'owner');

  const item = await prisma.collaborativeItem.findUnique({
    where: { item_id: itemId },
    select: { owner_id: true },
  });
  if (item?.owner_id === targetUserId) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Owner cannot be removed');
  }

  await prisma.permission.deleteMany({
    where: { user_id: targetUserId, item_id: itemId },
  });
}

async function upsertDocMemberRole(userId, itemId, targetUserId, { role }) {
  await assertDocumentAccess(itemId, userId, 'owner');

  const normalizedRole = String(role || '').toLowerCase();
  if (!MEMBER_ROLES.has(normalizedRole)) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Role must be viewer or editor');
  }

  const item = await prisma.collaborativeItem.findUnique({
    where: { item_id: itemId },
    select: { owner_id: true },
  });
  if (!item) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, 'Document not found');
  }
  if (item.owner_id === targetUserId) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'Owner role cannot be changed');
  }

  const member = await prisma.permission.upsert({
    where: { user_id_item_id: { user_id: targetUserId, item_id: itemId } },
    update: { role: normalizedRole },
    create: { user_id: targetUserId, item_id: itemId, role: normalizedRole },
    include: { user: true },
  });

  return toMemberDto(member);
}

module.exports = {
  listDocs,
  createDoc,
  getDocById,
  getDocSidebar,
  updateDoc,
  deleteDoc,
  listDocComments,
  createDocComment,
  createCommentReply,
  resolveDocComment,
  listDocVersions,
  createDocVersion,
  restoreDocVersion,
  listDocMembers,
  inviteDocMember,
  removeDocMember,
  upsertDocMemberRole,
  assertDocumentAccess,
};
