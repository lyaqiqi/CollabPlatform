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
   *   eventOperation?: string;  // 自定义 Yjs update 事件名
   *   eventCursor?: string;     // 自定义 Awareness 事件名
   * }} options
   */
  constructor(ydoc, { itemId, user, color, emit, on, off, eventOperation, eventCursor }) {
    this.ydoc = ydoc;
    this.itemId = itemId;
    this.emit = emit;
    this.destroyed = false;

    // 支持自定义事件名（白板用 board:yjs-update / board:yjs-cursor）
    this.eventOperation = eventOperation || SOCKET_EVENTS.DOC_OPERATION;
    this.eventCursor = eventCursor || SOCKET_EVENTS.DOC_CURSOR;

    this.awareness = new Awareness(ydoc);
    this.awareness.setLocalStateField('user', {
      id: user.user_id,
      name: user.username,
      color,
    });

    this._onYjsUpdate = (update, origin) => {
      if (origin === this || origin === 'persisted' || this.destroyed) return;
      emit(this.eventOperation, {
        itemId,
        update: uint8ToBase64(update),
      });
    };

    this._onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === this || this.destroyed) return;
      const changed = added.concat(updated, removed);
      if (changed.length === 0) return;
      const encoded = encodeAwarenessUpdate(this.awareness, changed);
      emit(this.eventCursor, {
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
    on(this.eventOperation, this._onRemoteOperation);
    on(this.eventCursor, this._onRemoteCursor);
  }

  destroy() {
    if (this.destroyed) return;
    removeAwarenessStates(this.awareness, [this.ydoc.clientID], 'local');
    this.destroyed = true;
    this.ydoc.off('update', this._onYjsUpdate);
    this.awareness.off('update', this._onAwarenessUpdate);
    this._off(this.eventOperation, this._onRemoteOperation);
    this._off(this.eventCursor, this._onRemoteCursor);
    this.awareness.destroy();
  }
}