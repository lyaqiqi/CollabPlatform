const folderService = require('../services/folder.service');
const { broadcastToTreeRoom } = require('../socket');
const { success } = require('../utils/response');

/**
 * 向 userId 的所有文档协作者广播 tree:reload，
 * 使他们重新 fetchTree() 以获取最新的文件夹结构。
 */
async function notifyCollaborators(userId) {
  try {
    const collaborators = await folderService.getDocumentCollaborators(userId);
    collaborators.forEach((uid) => broadcastToTreeRoom(uid, 'tree:reload', {}));
  } catch {
    // 通知失败不影响主流程
  }
}

async function getFolderTreeController(req, res, next) {
  try {
    const tree = await folderService.getFolderTree(req.user.userId);
    return success(res, tree);
  } catch (err) {
    next(err);
  }
}

async function createFolderController(req, res, next) {
  try {
    const folder = await folderService.createFolder(req.user.userId, req.body);
    broadcastToTreeRoom(req.user.userId, 'tree:folder-created', { folder });
    // 通知协作者：他们应该也能看到新建的文件夹
    notifyCollaborators(req.user.userId);
    return success(res, folder, '文件夹已创建', 201);
  } catch (err) {
    next(err);
  }
}

async function updateFolderController(req, res, next) {
  try {
    const folder = await folderService.updateFolder(req.user.userId, req.params.id, req.body);
    broadcastToTreeRoom(req.user.userId, 'tree:folder-updated', { folder });
    // 文件夹重命名/移动，协作者需要同步更新（他们可能看得到这个文件夹）
    notifyCollaborators(req.user.userId);
    return success(res, folder, '文件夹已更新');
  } catch (err) {
    next(err);
  }
}

async function deleteFolderController(req, res, next) {
  try {
    await folderService.deleteFolder(req.user.userId, req.params.id);
    broadcastToTreeRoom(req.user.userId, 'tree:folder-deleted', { folderId: req.params.id });
    // 文件夹删除，其中的共享文档会退回到协作者树的根级，需要通知
    notifyCollaborators(req.user.userId);
    return success(res, null, '文件夹已删除');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFolderTreeController,
  createFolderController,
  updateFolderController,
  deleteFolderController,
};
