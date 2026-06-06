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

  // 白板协作（B）
  // - BOARD_OPERATION: Yjs 增量更新（CRDT），用于多人无冲突合并
  // - BOARD_SYNC_REQUEST/RESPONSE: 新加入用户向房间请求完整状态，由任意在线协作者响应
  BOARD_DRAW: 'board:draw',
  BOARD_SYNC: 'board:sync',
  BOARD_CURSOR: 'board:cursor',
  BOARD_OPERATION: 'board:operation',
  BOARD_SYNC_REQUEST: 'board:sync-request',
  BOARD_SYNC_RESPONSE: 'board:sync-response',

  // 文档协作（C）
  DOC_OPERATION: 'doc:operation',
  DOC_CURSOR: 'doc:cursor',
  DOC_TITLE_CHANGED: 'doc:title-changed',     // 标题被其他用户修改
  DOC_SIDEBAR_CHANGED: 'doc:sidebar-changed', // 评论/版本有新变更，通知刷新侧边栏
  DOC_VERSION_RESTORED: 'doc:version-restored', // 某用户执行了版本恢复，需全员 reload

  BOARD_VERSION_RESTORED: 'board:version-restored',
};
