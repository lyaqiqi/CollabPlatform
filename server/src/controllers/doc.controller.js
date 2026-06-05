const docService = require('../services/doc.service');
const { broadcastToRoom } = require('../socket');
const { success } = require('../utils/response');

async function listDocsController(req, res, next) {
  try {
    const docs = await docService.listDocs(req.user.userId);
    return success(res, docs);
  } catch (err) {
    next(err);
  }
}

async function createDocController(req, res, next) {
  try {
    const doc = await docService.createDoc(req.user.userId, req.body);
    return success(res, doc, '文档创建成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getDocController(req, res, next) {
  try {
    const doc = await docService.getDocById(req.user.userId, req.params.id);
    return success(res, doc);
  } catch (err) {
    next(err);
  }
}

async function getDocSidebarController(req, res, next) {
  try {
    const data = await docService.getDocSidebar(req.user.userId, req.params.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function updateDocController(req, res, next) {
  try {
    const doc = await docService.updateDoc(req.user.userId, req.params.id, req.body);
    return success(res, doc, '文档已保存');
  } catch (err) {
    next(err);
  }
}

async function deleteDocController(req, res, next) {
  try {
    await docService.deleteDoc(req.user.userId, req.params.id);
    return success(res, null, '文档已删除');
  } catch (err) {
    next(err);
  }
}

async function listDocCommentsController(req, res, next) {
  try {
    const comments = await docService.listDocComments(req.user.userId, req.params.id);
    return success(res, comments);
  } catch (err) {
    next(err);
  }
}

async function createDocCommentController(req, res, next) {
  try {
    const comment = await docService.createDocComment(req.user.userId, req.params.id, req.body);
    broadcastToRoom(req.params.id, 'doc:sidebar-changed', { itemId: req.params.id });
    return success(res, comment, '评论已创建', 201);
  } catch (err) {
    next(err);
  }
}

async function createCommentReplyController(req, res, next) {
  try {
    const reply = await docService.createCommentReply(
      req.user.userId,
      req.params.id,
      req.params.commentId,
      req.body
    );
    broadcastToRoom(req.params.id, 'doc:sidebar-changed', { itemId: req.params.id });
    return success(res, reply, '回复已创建', 201);
  } catch (err) {
    next(err);
  }
}

async function resolveDocCommentController(req, res, next) {
  try {
    const comment = await docService.resolveDocComment(
      req.user.userId,
      req.params.id,
      req.params.commentId,
      req.body
    );
    broadcastToRoom(req.params.id, 'doc:sidebar-changed', { itemId: req.params.id });
    return success(res, comment, '评论状态已更新');
  } catch (err) {
    next(err);
  }
}

async function listDocVersionsController(req, res, next) {
  try {
    const versions = await docService.listDocVersions(req.user.userId, req.params.id);
    return success(res, versions);
  } catch (err) {
    next(err);
  }
}

async function createDocVersionController(req, res, next) {
  try {
    const version = await docService.createDocVersion(req.user.userId, req.params.id, req.body);
    return success(res, version, '版本快照已创建', 201);
  } catch (err) {
    next(err);
  }
}

async function restoreDocVersionController(req, res, next) {
  try {
    const doc = await docService.restoreDocVersion(
      req.user.userId,
      req.params.id,
      req.params.versionId
    );
    broadcastToRoom(req.params.id, 'doc:version-restored', {
      itemId: req.params.id,
      restoredBy: req.user.userId,
    });
    return success(res, doc, '文档已恢复到该版本');
  } catch (err) {
    next(err);
  }
}

async function inviteDocMemberController(req, res, next) {
  try {
    const member = await docService.inviteDocMember(req.user.userId, req.params.id, req.body);
    return success(res, member, '成员已邀请', 201);
  } catch (err) {
    next(err);
  }
}

async function removeDocMemberController(req, res, next) {
  try {
    await docService.removeDocMember(req.user.userId, req.params.id, req.params.targetUserId);
    return success(res, null, '成员已移除');
  } catch (err) {
    next(err);
  }
}

async function listDocMembersController(req, res, next) {
  try {
    const members = await docService.listDocMembers(req.user.userId, req.params.id);
    return success(res, members);
  } catch (err) {
    next(err);
  }
}

async function upsertDocMemberRoleController(req, res, next) {
  try {
    const member = await docService.upsertDocMemberRole(
      req.user.userId,
      req.params.id,
      req.params.targetUserId,
      req.body
    );
    return success(res, member, '成员权限已更新');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDocsController,
  createDocController,
  getDocController,
  getDocSidebarController,
  updateDocController,
  deleteDocController,
  listDocCommentsController,
  createDocCommentController,
  createCommentReplyController,
  resolveDocCommentController,
  listDocVersionsController,
  createDocVersionController,
  restoreDocVersionController,
  listDocMembersController,
  inviteDocMemberController,
  removeDocMemberController,
  upsertDocMemberRoleController,
};