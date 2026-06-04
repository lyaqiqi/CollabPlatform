const express = require('express');
const authMiddleware = require('../middlewares/auth');
const {
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
} = require('../controllers/doc.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', listDocsController);
router.post('/', createDocController);
router.get('/:id', getDocController);
router.get('/:id/sidebar', getDocSidebarController);
router.put('/:id', updateDocController);
router.delete('/:id', deleteDocController);

router.get('/:id/comments', listDocCommentsController);
router.post('/:id/comments', createDocCommentController);
router.post('/:id/comments/:commentId/replies', createCommentReplyController);
router.patch('/:id/comments/:commentId/resolve', resolveDocCommentController);

router.get('/:id/versions', listDocVersionsController);
router.post('/:id/versions', createDocVersionController);
router.post('/:id/versions/:versionId/restore', restoreDocVersionController);

router.get('/:id/members', listDocMembersController);
router.post('/:id/members/invite', inviteDocMemberController);
router.delete('/:id/members/:targetUserId', removeDocMemberController);
router.put('/:id/members/:targetUserId', upsertDocMemberRoleController);

module.exports = router;
