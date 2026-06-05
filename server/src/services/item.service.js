const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const ITEM_TYPES = ['Whiteboard', 'Document'];
const MEMBER_ROLES = ['editor', 'viewer'];

function normalizeTitle(title) {
  return typeof title === 'string' ? title.trim() : '';
}

function validateItemType(type) {
  if (!ITEM_TYPES.includes(type)) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '项目类型不合法');
  }
}

function buildInitialContent(type) {
  return type === 'Document' ? { content: '' } : { canvas: null };
}

function toItemSummary(item, userId) {
  return {
    item_id: item.item_id,
    title: item.title,
    type: item.type,
    owner_id: item.owner_id,
    is_public: item.is_public,
    created_at: item.created_at,
    updated_at: item.updated_at,
    role: item.owner_id === userId ? 'owner' : item.permissions[0]?.role || null,
  };
}

async function getItemRole(userId, itemId) {
  const item = await prisma.collaborativeItem.findUnique({
    where: { item_id: itemId },
    select: {
      item_id: true,
      owner_id: true,
      type: true,
      permissions: {
        where: { user_id: userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!item) {
    throw new AppError(404, AppError.CODES.NOT_FOUND, '项目不存在');
  }

  if (item.owner_id === userId) {
    return { role: 'owner', item };
  }

  return {
    role: item.permissions[0]?.role || null,
    item,
  };
}

async function assertItemReadable(userId, itemId) {
  const result = await getItemRole(userId, itemId);
  if (!result.role) {
    throw new AppError(403, AppError.CODES.FORBIDDEN, '无权访问该项目');
  }
  return result;
}

async function assertItemOwner(userId, itemId) {
  const result = await getItemRole(userId, itemId);
  if (result.role !== 'owner') {
    throw new AppError(403, AppError.CODES.FORBIDDEN, '仅项目所有者可执行该操作');
  }
  return result;
}

async function listItems(userId) {
  const items = await prisma.collaborativeItem.findMany({
    where: {
      OR: [{ owner_id: userId }, { permissions: { some: { user_id: userId } } }],
    },
    orderBy: { updated_at: 'desc' },
    select: {
      item_id: true,
      title: true,
      type: true,
      owner_id: true,
      is_public: true,
      created_at: true,
      updated_at: true,
      permissions: {
        where: { user_id: userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  return items.map((item) => toItemSummary(item, userId));
}

async function createItem(userId, { title, type }) {
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '项目标题不能为空');
  }
  if (normalizedTitle.length > 256) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '项目标题长度不能超过 256 个字符');
  }
  validateItemType(type);

  const item = await prisma.collaborativeItem.create({
    data: {
      owner_id: userId,
      title: normalizedTitle,
      type,
      content_data: buildInitialContent(type),
      permissions: {
        create: [{ user_id: userId, role: 'owner' }],
      },
    },
    select: {
      item_id: true,
      title: true,
      type: true,
      owner_id: true,
      is_public: true,
      created_at: true,
      updated_at: true,
    },
  });

  return { ...item, role: 'owner' };
}

async function getItemDetail(userId, itemId) {
  const { role } = await assertItemReadable(userId, itemId);

  const item = await prisma.collaborativeItem.findUnique({
    where: { item_id: itemId },
    select: {
      item_id: true,
      title: true,
      type: true,
      owner_id: true,
      is_public: true,
      created_at: true,
      updated_at: true,
      owner: {
        select: {
          user_id: true,
          username: true,
          email: true,
        },
      },
      permissions: {
        select: {
          permission_id: true,
          role: true,
          user: {
            select: {
              user_id: true,
              username: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const members = item.permissions.filter((permission) => permission.user.user_id !== item.owner_id);

  return {
    ...item,
    role,
    permissions: members,
  };
}

async function updateItemPermissions(userId, itemId, members) {
  await assertItemOwner(userId, itemId);

  if (!Array.isArray(members)) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'members 必须是数组');
  }

  const normalizedMembers = members.map((member) => ({
    email: typeof member?.email === 'string' ? member.email.trim().toLowerCase() : '',
    role: member?.role,
  }));

  if (normalizedMembers.some((member) => !member.email)) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '成员邮箱不能为空');
  }

  if (normalizedMembers.some((member) => !MEMBER_ROLES.includes(member.role))) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '成员角色不合法');
  }

  const uniqueEmails = new Set(normalizedMembers.map((member) => member.email));
  if (uniqueEmails.size !== normalizedMembers.length) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '成员邮箱不能重复');
  }

  const users = uniqueEmails.size
    ? await prisma.user.findMany({
        where: { email: { in: [...uniqueEmails] } },
        select: { user_id: true, email: true },
      })
    : [];

  if (users.length !== uniqueEmails.size) {
    const foundEmails = new Set(users.map((user) => user.email));
    const missingEmail = [...uniqueEmails].find((email) => !foundEmails.has(email));
    throw new AppError(404, AppError.CODES.NOT_FOUND, `用户不存在：${missingEmail}`);
  }

  if (users.some((user) => user.user_id === userId)) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '不能单独修改项目所有者权限');
  }

  const userIdByEmail = new Map(users.map((user) => [user.email, user.user_id]));
  const desiredMembers = normalizedMembers.map((member) => ({
    user_id: userIdByEmail.get(member.email),
    role: member.role,
  }));

  await prisma.$transaction(async (tx) => {
    const memberUserIds = desiredMembers.map((member) => member.user_id);

    await tx.permission.deleteMany({
      where: {
        item_id: itemId,
        role: { not: 'owner' },
      },
    });

    for (const member of desiredMembers) {
      await tx.permission.upsert({
        where: {
          user_id_item_id: {
            user_id: member.user_id,
            item_id: itemId,
          },
        },
        update: { role: member.role },
        create: {
          user_id: member.user_id,
          item_id: itemId,
          role: member.role,
        },
      });
    }
  });

  return getItemDetail(userId, itemId);
}

async function updateItemTitle(userId, itemId, title) {
  await assertItemOwner(userId, itemId);

  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '项目标题不能为空');
  }
  if (normalizedTitle.length > 256) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '项目标题长度不能超过 256 个字符');
  }

  const item = await prisma.collaborativeItem.update({
    where: { item_id: itemId },
    data: { title: normalizedTitle },
    select: {
      item_id: true,
      title: true,
      type: true,
      owner_id: true,
      is_public: true,
      created_at: true,
      updated_at: true,
    },
  });

  return { ...item, role: 'owner' };
}

async function deleteItem(userId, itemId) {
  await assertItemOwner(userId, itemId);

  await prisma.$transaction(async (tx) => {
    await tx.permission.deleteMany({ where: { item_id: itemId } });
    await tx.version.deleteMany({ where: { item_id: itemId } });
    await tx.comment.deleteMany({ where: { item_id: itemId } });
    
    await tx.collaborativeItem.delete({ where: { item_id: itemId } });
  });

  return { item_id: itemId };
}

module.exports = {
  listItems,
  createItem,
  getItemDetail,
  updateItemPermissions,
  getItemRole,
  assertItemReadable,
  assertItemOwner,
  updateItemTitle,
  deleteItem,
};
