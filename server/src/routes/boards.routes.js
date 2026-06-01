const express = require('express');
const authMiddleware = require('../middlewares/auth');
const boardController = require('../controllers/board.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', boardController.listBoardsController);
router.post('/', boardController.createBoardController);
router.get('/:id', boardController.getBoardController);
router.put('/:id', boardController.updateBoardController);
router.delete('/:id', boardController.deleteBoardController);

module.exports = router;

