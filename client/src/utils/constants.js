// 业务错误码（与后端 AppError.CODES 保持一致）
export const ERROR_CODES = {
  SUCCESS: 0,
  BAD_REQUEST: 40001,
  UNAUTHORIZED: 40101,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  CONFLICT: 40901,
  INTERNAL: 50000,
};

// Socket 事件名常量（前后端统一维护，减少拼写错误）
export const SOCKET_EVENTS = {
  // 基础房间
  JOIN: 'join',
  LEAVE: 'leave',
  PING: 'ping',
  PONG: 'pong',
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',

  // 白板协作（Yjs CRDT，与文档同构）
  BOARD_YJS_UPDATE: 'board:yjs-update',   // Yjs 增量更新（base64）
  BOARD_YJS_CURSOR: 'board:yjs-cursor',   // Awareness / 光标同步
  BOARD_YJS_SYNC_REQUEST: 'board:yjs-sync-request', // 加入/重连时请求房间内其他人补发全量状态
  BOARD_YJS_SYNC_STATE: 'board:yjs-sync-state',     // 携带全量状态的握手补发（写权限校验，失败静默不报错）
  BOARD_ERROR: 'board:error',             // 服务端拒绝操作（权限不足等）

  // 旧版整块广播事件（已弃用，仅保留常量以兼容历史代码）
  BOARD_DRAW: 'board:draw',
  BOARD_SYNC: 'board:sync',
  BOARD_CURSOR: 'board:cursor',

  // 文档协作（C）
  DOC_OPERATION: 'doc:operation',
  DOC_CURSOR: 'doc:cursor',
  DOC_TITLE_CHANGED: 'doc:title-changed',     // 标题被其他用户修改
  DOC_SIDEBAR_CHANGED: 'doc:sidebar-changed', // 评论/版本有新变更，通知刷新侧边栏
  DOC_VERSION_RESTORED: 'doc:version-restored', // 某用户执行了版本恢复，需全员 reload
  DOC_ERROR: 'doc:error',                        // 服务端拒绝操作（权限不足等）

  BOARD_VERSION_RESTORED: 'board:version-restored',

  // 文档树同步（C — 文件夹/文档增删改后由服务端推送）
  TREE_SUBSCRIBE: 'tree:subscribe',
  TREE_UNSUBSCRIBE: 'tree:unsubscribe',
  TREE_RELOAD: 'tree:reload',
  TREE_FOLDER_CREATED: 'tree:folder-created',
  TREE_FOLDER_UPDATED: 'tree:folder-updated',
  TREE_FOLDER_DELETED: 'tree:folder-deleted',
  TREE_DOC_CREATED: 'tree:doc-created',
  TREE_DOC_MOVED: 'tree:doc-moved',
  TREE_DOC_DELETED: 'tree:doc-deleted',
};
