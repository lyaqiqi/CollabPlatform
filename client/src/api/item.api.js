import request from './request';

export function listItems() {
  return request.get('/items');
}

export function createItem(data) {
  return request.post('/items', data);
}

export function getItemDetail(id) {
  return request.get(`/items/${id}`);
}

export function updateItemPermissions(id, data) {
  return request.put(`/items/${id}/permissions`, data);
}

export function updateItemTitle(itemId, title) {
  return request.put(`/items/${itemId}/title`, { title });
}

export function deleteItem(itemId) {
  return request.delete(`/items/${itemId}`);
}