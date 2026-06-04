import * as Y from 'yjs';

/** @param {Uint8Array} bytes */
export function uint8ToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** @param {string} base64 */
export function base64ToUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** @param {Y.Doc} ydoc */
export function encodeYjsState(ydoc) {
  return uint8ToBase64(Y.encodeStateAsUpdate(ydoc));
}

/** @param {Y.Doc} ydoc @param {string|null|undefined} base64 */
export function applyPersistedYjsState(ydoc, base64) {
  if (!base64) return;
  try {
    Y.applyUpdate(ydoc, base64ToUint8(base64), 'persisted');
  } catch (err) {
    console.warn('[yjs] 无法应用已保存的快照:', err);
  }
}
