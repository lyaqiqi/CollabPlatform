const express = require('express');
const authMiddleware = require('../middlewares/auth');
const itemController = require('../controllers/item.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', itemController.listItemsController);
router.post('/', itemController.createItemController);
router.get('/:id', itemController.getItemDetailController);
router.put('/:id/permissions', itemController.updateItemPermissionsController);

module.exports = router;
