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
  constructor(
    ydoc,
    {
      itemId,
      user,
      color,
      emit,
      on,
      off,
      eventOperation,
      eventCursor,
      eventSyncRequest,
      eventSyncState,
    }
  ) {
    this.ydoc = ydoc;
    this.itemId = itemId;
    this.emit = emit;
    this.destroyed = false;

    // 支持自定义事件名（白板用 board:yjs-update / board:yjs-cursor）
    this.eventOperation = eventOperation || SOCKET_EVENTS.DOC_OPERATION;
    this.eventCursor = eventCursor || SOCKET_EVENTS.DOC_CURSOR;
    // 同步握手事件（白板用 board:yjs-sync-request / board:yjs-sync-state）。
    // sync-request：请求补发（读权限）；sync-state：携带全量状态（写权限，失败静默）。
    this.eventSyncRequest = eventSyncRequest || SOCKET_EVENTS.BOARD_YJS_SYNC_REQUEST;
    this.eventSyncState = eventSyncState || SOCKET_EVENTS.BOARD_YJS_SYNC_STATE;

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

    // 收到同步请求：把自己的“全量状态”发回房间，供刚加入/刚重连的对端合并。
    // CRDT 合并是幂等的，全量补发不会产生冲突或重复内容。
    // 走 sync-state 通道（写权限校验、失败静默）——只有可写者才需要、也才能补发状态。
    this._onSyncRequest = ({ itemId }) => {
      if (itemId !== this.itemId || this.destroyed) return;
      this._emitFullState();
    };

    // 收到对端补发的全量状态：直接合并进本地文档。
    this._onRemoteSyncState = ({ itemId, update }) => {
      if (itemId !== this.itemId || !update) return;
      Y.applyUpdate(this.ydoc, base64ToUint8(update), this);
    };

    this._off = off;

    ydoc.on('update', this._onYjsUpdate);
    this.awareness.on('update', this._onAwarenessUpdate);
    on(this.eventOperation, this._onRemoteOperation);
    on(this.eventCursor, this._onRemoteCursor);
    on(this.eventSyncRequest, this._onSyncRequest);
    on(this.eventSyncState, this._onRemoteSyncState);
  }

  /** 把本地全量状态推给房间（仅可写者会被服务端放行，读者失败静默、无报错）。 */
  _emitFullState() {
    if (this.destroyed) return;
    this.emit(this.eventSyncState, {
      itemId: this.itemId,
      update: uint8ToBase64(Y.encodeStateAsUpdate(this.ydoc)),
    });
  }

  /**
   * 加入房间 / 断线重连后调用：
   *  1) 向房间广播同步请求，拉取其他人的全量状态（补齐自己缺失的内容）；
   *  2) 主动把自己的全量状态推给房间，补齐别人在自己离线期间错过的本地改动。
   * 二者叠加即可保证 late-join 与重连都能自愈，不再丢笔迹。
   */
  requestSync() {
    if (this.destroyed) return;
    this.emit(this.eventSyncRequest, { itemId: this.itemId });
    this._emitFullState();
  }

  destroy() {
    if (this.destroyed) return;
    removeAwarenessStates(this.awareness, [this.ydoc.clientID], 'local');
    this.destroyed = true;
    this.ydoc.off('update', this._onYjsUpdate);
    this.awareness.off('update', this._onAwarenessUpdate);
    this._off(this.eventOperation, this._onRemoteOperation);
    this._off(this.eventCursor, this._onRemoteCursor);
    this._off(this.eventSyncRequest, this._onSyncRequest);
    this._off(this.eventSyncState, this._onRemoteSyncState);
    this.awareness.destroy();
  }
}