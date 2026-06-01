import request from './request';

export function listBoards() {
  return request.get('/boards');
}

export function createBoard(data) {
  return request.post('/boards', data);
}

export function getBoard(id) {
  return request.get(`/boards/${id}`);
}

export function updateBoard(id, data) {
  return request.put(`/boards/${id}`, data);
}

export function deleteBoard(id) {
  return request.delete(`/boards/${id}`);
}

