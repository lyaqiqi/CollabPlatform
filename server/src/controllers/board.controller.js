const boardService = require('../services/board.service');
const { broadcastToRoom } = require('../socket');
const { success } = require('../utils/response');

async function listBoardsController(req, res, next) {
  try {
    const boards = await boardService.listBoards(req.user.userId);
    return success(res, boards);
  } catch (err) {
    next(err);
  }
}

async function createBoardController(req, res, next) {
  try {
    const board = await boardService.createBoard(req.user.userId, req.body || {});
    return success(res, board, '创建成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getBoardController(req, res, next) {
  try {
    const board = await boardService.getBoard(req.user.userId, req.params.id);
    return success(res, board);
  } catch (err) {
    next(err);
  }
}

async function updateBoardController(req, res, next) {
  try {
    const board = await boardService.updateBoard(req.user.userId, req.params.id, req.body || {});
    return success(res, board, '更新成功');
  } catch (err) {
    next(err);
  }
}

async function deleteBoardController(req, res, next) {
  try {
    const result = await boardService.deleteBoard(req.user.userId, req.params.id);
    return success(res, result, '删除成功');
  } catch (err) {
    next(err);
  }
}

async function listBoardVersionsController(req, res, next) {
  try {
    const versions = await boardService.listBoardVersions(req.user.userId, req.params.id);
    return success(res, versions);
  } catch (err) {
    next(err);
  }
}

async function createBoardVersionController(req, res, next) {
  try {
    const version = await boardService.createBoardVersion(req.user.userId, req.params.id, req.body);
    return success(res, version, '版本快照已创建', 201);
  } catch (err) {
    next(err);
  }
}

async function restoreBoardVersionController(req, res, next) {
  try {
    const board = await boardService.restoreBoardVersion(
      req.user.userId,
      req.params.id,
      req.params.versionId
    );
    // 广播给房间内所有人（包括操作者自己）版本已恢复，各端均需重载白板
    broadcastToRoom(req.params.id, 'board:version-restored', {
      itemId: req.params.id,
      restoredBy: req.user.userId,
    });
    return success(res, board, '白板已恢复到该版本');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBoardsController,
  createBoardController,
  getBoardController,
  updateBoardController,
  deleteBoardController,
  listBoardVersionsController,
  createBoardVersionController,
  restoreBoardVersionController,
};

