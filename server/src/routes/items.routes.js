const express = require('express');
const authMiddleware = require('../middlewares/auth');
const itemController = require('../controllers/item.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', itemController.listItemsController);
router.post('/', itemController.createItemController);
router.get('/:id', itemController.getItemDetailController);
router.put('/:id/permissions', itemController.updateItemPermissionsController);
router.put('/:id/title', itemController.updateItemTitleController);
router.delete('/:id', itemController.deleteItemController);

module.exports = router;
