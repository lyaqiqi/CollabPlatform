const express = require('express');
const authMiddleware = require('../middlewares/auth');
const {
  getFolderTreeController,
  createFolderController,
  updateFolderController,
  deleteFolderController,
} = require('../controllers/folder.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/tree', getFolderTreeController);
router.post('/', createFolderController);
router.patch('/:id', updateFolderController);
router.delete('/:id', deleteFolderController);

module.exports = router;
