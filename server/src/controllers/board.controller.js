const boardService = require('../services/board.service');
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

module.exports = {
  listBoardsController,
  createBoardController,
  getBoardController,
  updateBoardController,
  deleteBoardController,
};

