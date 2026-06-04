const itemService = require('../services/item.service');
const { success } = require('../utils/response');

async function listItemsController(req, res, next) {
  try {
    const items = await itemService.listItems(req.user.userId);
    return success(res, items);
  } catch (err) {
    next(err);
  }
}

async function createItemController(req, res, next) {
  try {
    const item = await itemService.createItem(req.user.userId, req.body || {});
    return success(res, item, '项目创建成功', 201);
  } catch (err) {
    next(err);
  }
}

async function getItemDetailController(req, res, next) {
  try {
    const item = await itemService.getItemDetail(req.user.userId, req.params.id);
    return success(res, item);
  } catch (err) {
    next(err);
  }
}

async function updateItemPermissionsController(req, res, next) {
  try {
    const item = await itemService.updateItemPermissions(
      req.user.userId,
      req.params.id,
      req.body?.members
    );
    return success(res, item, '成员权限更新成功');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listItemsController,
  createItemController,
  getItemDetailController,
  updateItemPermissionsController,
};
