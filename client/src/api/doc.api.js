import request from './request';

/** @returns {Promise<Array>} */
export function listDocs() {
  return request.get('/docs');
}

/** @param {{ title?: string }} data */
export function createDoc(data) {
  return request.post('/docs', data);
}

/** @param {string} id */
export function getDoc(id) {
  return request.get(`/docs/${id}`);
}

/**
 * @param {string} id
 * @param {{ title?: string, content_data?: object }} data
 */
export function updateDoc(id, data) {
  return request.put(`/docs/${id}`, data);
}

/** @param {string} id */
export function deleteDoc(id) {
  return request.delete(`/docs/${id}`);
}

/** @param {string} id */
export function getDocSidebar(id) {
  return request.get(`/docs/${id}/sidebar`);
}

/** @param {string} id */
export function listDocComments(id) {
  return request.get(`/docs/${id}/comments`);
}

/**
 * @param {string} id
 * @param {{ content: string, position?: object }} data
 */
export function createDocComment(id, data) {
  return request.post(`/docs/${id}/comments`, data);
}

/**
 * @param {string} id
 * @param {string} commentId
 * @param {{ content: string }} data
 */
export function createCommentReply(id, commentId, data) {
  return request.post(`/docs/${id}/comments/${commentId}/replies`, data);
}

/**
 * @param {string} id
 * @param {string} commentId
 * @param {{ is_resolved: boolean }} data
 */
export function resolveDocComment(id, commentId, data) {
  return request.patch(`/docs/${id}/comments/${commentId}/resolve`, data);
}

/** @param {string} id */
export function listDocVersions(id) {
  return request.get(`/docs/${id}/versions`);
}

/**
 * @param {string} id
 * @param {{ content_snapshot?: object }} data
 */
export function createDocVersion(id, data = {}) {
  return request.post(`/docs/${id}/versions`, data);
}

/**
 * 将文档内容回滚到指定版本快照
 * @param {string} id
 * @param {string} versionId
 */
export function restoreDocVersion(id, versionId) {
  return request.post(`/docs/${id}/versions/${versionId}/restore`);
}

/** @param {string} id */
export function listDocMembers(id) {
  return request.get(`/docs/${id}/members`);
}

/**
 * @param {string} id
 * @param {string} targetUserId
 * @param {{ role: 'viewer'|'editor' }} data
 */
export function upsertDocMemberRole(id, targetUserId, data) {
  return request.put(`/docs/${id}/members/${targetUserId}`, data);
}

/**
 * 通过邮箱或用户名邀请成员
 * @param {string} id
 * @param {{ email_or_username: string, role: 'viewer'|'editor' }} data
 */
export function inviteDocMember(id, data) {
  return request.post(`/docs/${id}/members/invite`, data);
}

/**
 * 移除文档成员
 * @param {string} id
 * @param {string} targetUserId
 */
export function removeDocMember(id, targetUserId) {
  return request.delete(`/docs/${id}/members/${targetUserId}`);
}
