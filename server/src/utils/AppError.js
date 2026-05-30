/**
 * 业务自定义错误类，由错误中间件统一捕获并返回标准格式。
 */
class AppError extends Error {
  /**
   * @param {number} httpStatus  HTTP 状态码（如 400、401、404）
   * @param {number} code        业务错误码（如 40001、40101）
   * @param {string} message     错误描述
   */
  constructor(httpStatus, code, message) {
    super(message);
    this.name = 'AppError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

// 统一错误码常量
AppError.CODES = {
  SUCCESS: 0,
  BAD_REQUEST: 40001,       // 请求参数错误
  UNAUTHORIZED: 40101,      // 未登录 / token 失效
  FORBIDDEN: 40301,         // 无权限操作
  NOT_FOUND: 40401,         // 资源不存在
  CONFLICT: 40901,          // 资源冲突（如邮箱已注册）
  INTERNAL: 50000,          // 服务器内部错误
};

module.exports = AppError;
