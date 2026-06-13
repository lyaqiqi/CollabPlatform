import request from './request';

/**
 * 拉取当前用户的整棵文件夹树 + 可访问文档节点
 * @returns {Promise<{ folders: Array, documents: Array }>}
 */
export function getFolderTree() {
  return request.get('/folders/tree');
}

/** @param {{ name: string, parent_id?: string|null }} data */
export function createFolder(data) {
  return request.post('/folders', data);
}

/**
 * @param {string} id
 * @param {{ name?: string, parent_id?: string|null, sort_order?: number }} data
 */
export function updateFolder(id, data) {
  return request.patch(`/folders/${id}`, data);
}

/** @param {string} id */
export function deleteFolder(id) {
  return request.delete(`/folders/${id}`);
}

/**
 * 把文档移入/移出文件夹（folder_id 传 null 表示移到未分类）
 * @param {string} docId
 * @param {string|null} folderId
 */
export function moveDocToFolder(docId, folderId) {
  return request.patch(`/docs/${docId}/folder`, { folder_id: folderId });
}
