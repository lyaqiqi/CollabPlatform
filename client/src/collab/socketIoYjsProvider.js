import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import { SOCKET_EVENTS } from '../utils/constants';
import { base64ToUint8, uint8ToBase64 } from './yjsUtils';

/**
 * 将 Yjs 文档与 Awareness 通过现有 Socket.io 通道同步。
 * 与 @tiptap/extension-collaboration-cursor 兼容（需提供 awareness）。
 */
export class SocketIoYjsProvider {
  /**
   * @param {Y.Doc} ydoc
   * @param {{
   *   itemId: string;
   *   user: { user_id: string; username: string };
   *   color: string;
   *   emit: (event: string, data: unknown) => void;
   *   on: (event: string, handler: Function) => void;
   *   off: (event: string, handler: Function) => void;
   * }} options
   */
  constructor(ydoc, { itemId, user, color, emit, on, off }) {
    this.ydoc = ydoc;
    this.itemId = itemId;
    this.emit = emit;
    this.destroyed = false;

    this.awareness = new Awareness(ydoc);
    this.awareness.setLocalStateField('user', {
      id: user.user_id,   // 用于在线用户去重（同一用户多标签/刷新时）
      name: user.username,
      color,
    });

    this._onYjsUpdate = (update, origin) => {
      // origin === this：远端回传的更新；origin === 'persisted'：本地注水的历史快照。
      // 两者都不应再广播出去，否则会污染房间内其他用户的文档。
      if (origin === this || origin === 'persisted' || this.destroyed) return;
      emit(SOCKET_EVENTS.DOC_OPERATION, {
        itemId,
        update: uint8ToBase64(update),
      });
    };

    this._onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === this || this.destroyed) return;
      const changed = added.concat(updated, removed);
      if (changed.length === 0) return;
      const encoded = encodeAwarenessUpdate(this.awareness, changed);
      emit(SOCKET_EVENTS.DOC_CURSOR, {
        itemId,
        update: uint8ToBase64(encoded),
      });
    };

    this._onRemoteOperation = ({ itemId, update }) => {
      if (itemId !== this.itemId || !update) return;
      Y.applyUpdate(this.ydoc, base64ToUint8(update), this);
    };

    this._onRemoteCursor = ({ itemId, update }) => {
      if (itemId !== this.itemId || !update) return;
      applyAwarenessUpdate(this.awareness, base64ToUint8(update), this);
    };

    this._off = off;

    ydoc.on('update', this._onYjsUpdate);
    this.awareness.on('update', this._onAwarenessUpdate);
    on(SOCKET_EVENTS.DOC_OPERATION, this._onRemoteOperation);
    on(SOCKET_EVENTS.DOC_CURSOR, this._onRemoteCursor);
  }

  destroy() {
    if (this.destroyed) return;
    // 先在 destroyed 仍为 false、_onAwarenessUpdate 仍挂载时移除本地 Awareness 状态，
    // 让离开事件能正常广播出去，避免其他用户残留本用户的“幽灵”光标 / 在线项。
    removeAwarenessStates(this.awareness, [this.ydoc.clientID], 'local');
    this.destroyed = true;
    this.ydoc.off('update', this._onYjsUpdate);
    this.awareness.off('update', this._onAwarenessUpdate);
    this._off(SOCKET_EVENTS.DOC_OPERATION, this._onRemoteOperation);
    this._off(SOCKET_EVENTS.DOC_CURSOR, this._onRemoteCursor);
    this.awareness.destroy();
  }
}
