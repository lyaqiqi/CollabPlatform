/**
 * 统一响应格式封装。
 * 成功: { code: 0, data: <任意>, message: "success" }
 * 失败: { code: <错误码>, data: null, message: "<错误描述>" }
 */

/**
 * 返回成功响应
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} message
 * @param {number} httpStatus
 */
function success(res, data = null, message = 'success', httpStatus = 200) {
  return res.status(httpStatus).json({ code: 0, data, message });
}

/**
 * 返回失败响应
 * @param {import('express').Response} res
 * @param {number} httpStatus
 * @param {number} code       业务错误码
 * @param {string} message
 */
function fail(res, httpStatus, code, message) {
  return res.status(httpStatus).json({ code, data: null, message });
}

module.exports = { success, fail };
