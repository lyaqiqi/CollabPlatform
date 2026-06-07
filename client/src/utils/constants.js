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

  BOARD_DRAW: 'board:draw',
  BOARD_SYNC: 'board:sync',
  BOARD_CURSOR: 'board:cursor',
  BOARD_VERSION_RESTORED: 'board:version-restored',
  BOARD_ERROR: 'board:error',

  // 文档协作（C）
  DOC_OPERATION: 'doc:operation',
  DOC_CURSOR: 'doc:cursor',
  DOC_TITLE_CHANGED: 'doc:title-changed',
  DOC_SIDEBAR_CHANGED: 'doc:sidebar-changed',
  DOC_VERSION_RESTORED: 'doc:version-restored',
  DOC_ERROR: 'doc:error',
};
