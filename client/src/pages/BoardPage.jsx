import { Layout, Typography, Space, Button, Card, Tag, Input, Modal, Empty, List, Tooltip, Slider, ColorPicker } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons'; 
import { Link, useParams, useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import {
  HistoryOutlined,
  CloseOutlined,
  EyeOutlined,
  RollbackOutlined,
  ClockCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import {
  getBoard,
  updateBoard,
  listBoardVersions,
  createBoardVersion,
  restoreBoardVersion,
} from '../api/board.api';
import useAuthStore from '../store/authStore';
import { useSocket, SocketStatus } from '../socket/useSocket';
import { SOCKET_EVENTS } from '../utils/constants';
import * as Y from 'yjs';
import { applyPersistedYjsState, base64ToUint8, encodeYjsState, uint8ToBase64 } from '../collab/yjsUtils';

const { Content } = Layout;

const TOOLS = {
  SELECT: 'select',
  PENCIL: 'pencil',
  RECT: 'rect',
  CIRCLE: 'circle',
  ARROW: 'arrow',
  TEXT: 'text',
};

const UI_TEXT = {
  CONNECTED: '\u5df2\u8fde\u63a5',
  CONNECTING: '\u8fde\u63a5\u4e2d',
  RECONNECTING: '\u91cd\u8fde\u4e2d',
  DISCONNECTED: '\u672a\u8fde\u63a5',
  BOARD: '\u767d\u677f',
  UNSAVED: '\u672a\u4fdd\u5b58',
  SAVED: '\u5df2\u4fdd\u5b58',
  PREVIEWING: '\u9884\u89c8\u4e2d',
  VERSION_HISTORY: '\u7248\u672c\u5386\u53f2',
  UNDO: '\u64a4\u9500',
  REDO: '\u91cd\u505a',
  DELETE: '\u5220\u9664',
  EXPORT_PNG: '\u5bfc\u51fa PNG',
  SAVE: '\u4fdd\u5b58',
  BACK_HOME: '\u56de\u5230\u4e3b\u754c\u9762',
  BOARD_TITLE: '\u767d\u677f\u6807\u9898',
  SELECT: '\u9009\u62e9',
  PENCIL: '\u753b\u7b14',
  RECT: '\u77e9\u5f62',
  CIRCLE: '\u5706\u5f62',
  ARROW: '\u7bad\u5934',
  TEXT: '\u6587\u5b57',
  STROKE: '\u7ebf\u6761',
  FILL: '\u586b\u5145',
  STROKE_WIDTH: '\u7ebf\u5bbd',
  ON: '\u5f00',
  OFF: '\u5173',
  PREVIEW_BANNER: '\u6b63\u5728\u9884\u89c8\u5386\u53f2\u7248\u672c',
  EXIT_PREVIEW: '\u9000\u51fa\u9884\u89c8',
  LOADING: '\u52a0\u8f7d\u4e2d...',
  NO_VERSIONS: '\u6682\u65e0\u7248\u672c\u5feb\u7167',
  SAVE_VERSION: '\u4fdd\u5b58\u7248\u672c',
  TOOLTIP_SAVE_VERSION: '\u624b\u52a8\u4fdd\u5b58\u5f53\u524d\u7248\u672c',
  TOOLTIP_PREVIEW: '\u9884\u89c8',
  TOOLTIP_RESTORE: '\u6062\u590d\u5230\u6b64\u7248\u672c',
  VERSION: '\u7248\u672c',
  MANUAL: '\u624b\u52a8',
  AUTO: '\u81ea\u52a8',
  MANUAL_SAVE_DEFAULT: '\u624b\u52a8\u4fdd\u5b58',
  VERSION_LABEL_PLACEHOLDER: '\u7248\u672c\u5907\u6ce8\uff08\u53ef\u9009\uff09',
  PERMISSION_DENIED: '\u6743\u9650\u4e0d\u8db3',
  ONLY_OWNER_CAN_RESTORE: '\u4ec5\u767d\u677f\u6240\u6709\u8005\u53ef\u6062\u590d\u7248\u672c',
  CONFIRM_RESTORE: '\u786e\u8ba4\u6062\u590d\u7248\u672c',
  CONFIRM: '\u786e\u5b9a',
  CANCEL: '\u53d6\u6d88',
  RESTORE: '\u6062\u590d',
  RESTORE_SUCCESS: '\u7248\u672c\u6062\u590d\u6210\u529f',
  RESTORE_FAIL: '\u6062\u590d\u5931\u8d25',
  SAVE_SUCCESS: '\u5df2\u4fdd\u5b58',
  SAVE_FAIL: '\u4fdd\u5b58\u5931\u8d25',
  LOAD_FAIL: '\u767d\u677f\u52a0\u8f7d\u5931\u8d25',
  VERSION_MISSING_CANVAS: '\u8be5\u7248\u672c\u6ca1\u6709\u53ef\u9884\u89c8\u7684\u5185\u5bb9',
  SAVE_SNAPSHOT: '\u4fdd\u5b58\u7248\u672c\u5feb\u7167',
  UNTITLED_BOARD: '\u672a\u547d\u540d\u767d\u677f',
  RESTORE_CONFIRM_PREFIX: '\u6062\u590d\u540e\u767d\u677f\u5185\u5bb9\u5c06\u56de\u6eda\u5230 ',
  RESTORE_CONFIRM_SUFFIX: '\uff0c\u5f53\u524d\u5185\u5bb9\u5c06\u88ab\u8986\u76d6\u3002\u786e\u5b9a\u7ee7\u7eed\uff1f',
  REMOTE_RESTORED: '\u534f\u4f5c\u8005\u6062\u590d\u4e86\u7248\u672c\u5feb\u7167\uff0c\u767d\u677f\u5373\u5c06\u5237\u65b0\u2026',
};

function hashColor(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 80% 45%)`;
}

function serializeCanvas(canvas) {
  return JSON.stringify(canvas.toJSON());
}

function safeParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function formatTime(value) {
  if (!value) return '-';
  try {
    const d = new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return String(value);
  }
}

function BoardPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const { connect, joinRoom, leaveRoom, emit, on, off, status: socketStatus } = useSocket();

  const containerRef = useRef(null);
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const applyingRemoteRef = useRef(false);
  const drawingRef = useRef({ isDown: false, startX: 0, startY: 0, tempObj: null });
  const toolRef = useRef(TOOLS.SELECT);
  const lastCursorSentAtRef = useRef(0);
  const joinedRef = useRef(false);
  const requestedSyncRef = useRef(false);
  const saveTimerRef = useRef(null);
  const syncTimerRef = useRef(null);
  const historyRef = useRef({ stack: [], index: -1 });
  const previewBackupRef = useRef(null);
  const lastAutoSnapshotRef = useRef(null);
  const lastAutoSaveTimeRef = useRef(0);
  const navigate = useNavigate();

  const ydocRef = useRef(null);
  const yObjectsRef = useRef(null);
  const yUndoManagerRef = useRef(null);
  const applyingYjsRef = useRef(false);
  const suppressYjsEmitRef = useRef(false);
  const objectIndexRef = useRef(new Map());

  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState(null);
  const [tool, setTool] = useState(TOOLS.SELECT);
  const [title, setTitle] = useState('');
  const [dirty, setDirty] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [versions, setVersions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewingVersion, setPreviewingVersion] = useState(null);
  const [savingManual, setSavingManual] = useState(false);   // ← 手动保存loading

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokeColor, setStrokeColor] = useState('#1890ff');
  const [fillColor, setFillColor] = useState('rgba(24, 144, 255, 0.15)');
  const [fillEnabled, setFillEnabled] = useState(true);

  toolRef.current = tool;

  const connectionTag = useMemo(() => {
    if (socketStatus === SocketStatus.CONNECTED || socketStatus === SocketStatus.RECOVERED) {
      return <Tag color="green">{UI_TEXT.CONNECTED}</Tag>;
    }
    if (socketStatus === SocketStatus.CONNECTING) return <Tag color="blue">{UI_TEXT.CONNECTING}</Tag>;
    if (socketStatus === SocketStatus.RECONNECTING) return <Tag color="orange">{UI_TEXT.RECONNECTING}</Tag>;
    return <Tag>{UI_TEXT.DISCONNECTED}</Tag>;
  }, [socketStatus]);

  const updateUndoState = useCallback(() => {
    const um = yUndoManagerRef.current;
    if (!um) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }
    setCanUndo(um.canUndo());
    setCanRedo(um.canRedo());
  }, []);

  const ensureObjectId = useCallback((obj) => {
    if (!obj) return null;
    const current = obj.objectId || obj.get?.('objectId');
    if (current) {
      if (!obj.objectId) obj.objectId = current;
      if (obj.get?.('objectId') !== current) obj.set?.('objectId', current);
      return current;
    }
    const next = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    obj.objectId = next;
    obj.set?.('objectId', next);
    return next;
  }, []);

  const serializeFabricObject = useCallback((obj) => {
    if (!obj) return null;
    ensureObjectId(obj);
    return JSON.stringify(obj.toObject(['objectId']));
  }, [ensureObjectId]);

  const upsertYjsObjectFromFabric = useCallback((obj) => {
    const ydoc = ydocRef.current;
    const yObjects = yObjectsRef.current;
    if (!ydoc || !yObjects) return;
    const id = ensureObjectId(obj);
    const jsonStr = serializeFabricObject(obj);
    if (!id || !jsonStr) return;
    ydoc.transact(() => {
      yObjects.set(id, jsonStr);
    }, 'local-fabric');
  }, [ensureObjectId, serializeFabricObject]);

  const deleteYjsObject = useCallback((objectId) => {
    const ydoc = ydocRef.current;
    const yObjects = yObjectsRef.current;
    if (!ydoc || !yObjects || !objectId) return;
    ydoc.transact(() => {
      yObjects.delete(objectId);
    }, 'local-fabric');
  }, []);

  const applyYjsObjectToCanvas = useCallback(async (objectId, jsonStr) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!objectId || !jsonStr) return;
    const parsed = safeParseJson(jsonStr);
    if (!parsed) return;

    applyingYjsRef.current = true;
    try {
      const existing = objectIndexRef.current.get(objectId);
      if (existing) {
        canvas.remove(existing);
        objectIndexRef.current.delete(objectId);
      }
      const obj = await new Promise((resolve) => {
        fabric.util.enlivenObjects([parsed], (enlivened) => resolve(enlivened?.[0] || null));
      });
      if (!obj) return;
      obj.objectId = objectId;
      obj.set?.('objectId', objectId);
      canvas.add(obj);
      objectIndexRef.current.set(objectId, obj);
      canvas.requestRenderAll();
    } finally {
      applyingYjsRef.current = false;
    }
  }, []);

  const removeYjsObjectFromCanvas = useCallback((objectId) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!objectId) return;
    const existing = objectIndexRef.current.get(objectId);
    if (!existing) return;
    applyingYjsRef.current = true;
    try {
      canvas.remove(existing);
      objectIndexRef.current.delete(objectId);
      canvas.requestRenderAll();
    } finally {
      applyingYjsRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!id) return undefined;

    const ydoc = new Y.Doc();
    const yObjects = ydoc.getMap('objects');
    const undoManager = new Y.UndoManager(yObjects);

    ydocRef.current = ydoc;
    yObjectsRef.current = yObjects;
    yUndoManagerRef.current = undoManager;
    updateUndoState();

    const onUndoChanged = () => updateUndoState();
    undoManager.on('stack-item-added', onUndoChanged);
    undoManager.on('stack-item-popped', onUndoChanged);
    undoManager.on('stack-cleared', onUndoChanged);

    const onYUpdate = (update, origin) => {
      if (origin === 'remote' || origin === 'persisted') return;
      if (suppressYjsEmitRef.current) return;
      emit(SOCKET_EVENTS.BOARD_OPERATION, { itemId: id, update: uint8ToBase64(update) });
    };
    ydoc.on('update', onYUpdate);

    const onYObjectsChanged = (event) => {
      if (event?.transaction?.origin === 'local-fabric') return;
      const keys = Array.from(event.keysChanged);
      keys.forEach((key) => {
        const value = yObjects.get(key);
        if (typeof value === 'undefined') {
          removeYjsObjectFromCanvas(key);
        } else {
          applyYjsObjectToCanvas(key, value);
        }
      });
    };
    yObjects.observe(onYObjectsChanged);

    return () => {
      yObjects.unobserve(onYObjectsChanged);
      ydoc.off('update', onYUpdate);
      undoManager.off('stack-item-added', onUndoChanged);
      undoManager.off('stack-item-popped', onUndoChanged);
      undoManager.off('stack-cleared', onUndoChanged);
      ydoc.destroy();
      ydocRef.current = null;
      yObjectsRef.current = null;
      yUndoManagerRef.current = null;
      objectIndexRef.current = new Map();
      updateUndoState();
    };
  }, [applyYjsObjectToCanvas, emit, id, removeYjsObjectFromCanvas, updateUndoState]);

  const takeSnapshot = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const { stack, index } = historyRef.current;
    const snapshot = serializeCanvas(canvas);
    const nextStack = stack.slice(0, index + 1);
    nextStack.push(snapshot);
    const capped = nextStack.slice(-50);
    historyRef.current = { stack: capped, index: capped.length - 1 };
  }, []);

  const applySnapshot = useCallback(
    (snapshotStr, { emitSync, save } = { emitSync: true, save: true }) => {
      const canvas = fabricRef.current;
      const parsed = safeParseJson(snapshotStr);
      if (!canvas || !parsed) return;
      applyingRemoteRef.current = true;
      canvas.loadFromJSON(parsed, () => {
        canvas.renderAll();
        applyingRemoteRef.current = false;
        if (emitSync) {}
        if (save) {
          setDirty(true);
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            const ydoc = ydocRef.current;
            updateBoard(id, { title, content_data: { canvas: snapshotStr, yjs: ydoc ? encodeYjsState(ydoc) : null } }).catch(() => {});
            setDirty(false);
          }, 1200);
        }
      });
    },
    [id, title]
  );

  const scheduleSyncAndSave = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (applyingRemoteRef.current) return;

    setDirty(true);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const snapshotStr = serializeCanvas(canvas);
      const ydoc = ydocRef.current;
      updateBoard(id, { title, content_data: { canvas: snapshotStr, yjs: ydoc ? encodeYjsState(ydoc) : null } }).catch(() => {});
      setDirty(false);
    }, 1200);
  }, [id, title]);

  const saveNow = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const snapshotStr = serializeCanvas(canvas);
    const ydoc = ydocRef.current;
    updateBoard(id, { title, content_data: { canvas: snapshotStr, yjs: ydoc ? encodeYjsState(ydoc) : null } })
      .then(() => {
        setDirty(false);
        Toast.success(UI_TEXT.SAVE_SUCCESS);
      })
      .catch((e) => Toast.error(e.message || UI_TEXT.SAVE_FAIL));
  }, [id, title]);

  const exportPng = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${title || 'whiteboard'}.png`;
    a.click();
  }, [title]);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (!active.length) return;
    active.forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    takeSnapshot();
    scheduleSyncAndSave();
  }, [scheduleSyncAndSave, takeSnapshot]);

  const undo = useCallback(() => {
    yUndoManagerRef.current?.undo();
    updateUndoState();
  }, [updateUndoState]);

  const redo = useCallback(() => {
    yUndoManagerRef.current?.redo();
    updateUndoState();
  }, [updateUndoState]);

  // Versions
  const fetchVersions = useCallback(async () => {
    try {
      const data = await listBoardVersions(id);
      setVersions(data);
    } catch (e) {
      console.error('fetch versions failed', e);
    }
  }, [id]);

  const handlePreviewVersion = useCallback(
    (version) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const snapshot = version.content_snapshot;
      if (!snapshot?.canvas) {
        Toast.error(UI_TEXT.VERSION_MISSING_CANVAS);
        return;
      }
      if (!previewingVersion) {
        previewBackupRef.current = serializeCanvas(canvas);
      }
      setPreviewingVersion(version);
      applyingRemoteRef.current = true;
      const parsed = safeParseJson(snapshot.canvas);
      if (parsed) {
        canvas.loadFromJSON(parsed, () => {
          canvas.renderAll();
          applyingRemoteRef.current = false;
        });
      } else {
        applyingRemoteRef.current = false;
      }
    },
    [previewingVersion]
  );

  const handleExitPreview = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setPreviewingVersion(null);
    const backup = previewBackupRef.current;
    if (backup) {
      applyingRemoteRef.current = true;
      const parsed = safeParseJson(backup);
      canvas.loadFromJSON(parsed, () => {
        canvas.renderAll();
        applyingRemoteRef.current = false;
        previewBackupRef.current = null;
      });
    }
  }, []);

  const handleRestoreVersion = useCallback(
    (versionId) => {
      if (board?.owner_id !== user?.user_id) {
        Modal.warning({ title: UI_TEXT.PERMISSION_DENIED, content: UI_TEXT.ONLY_OWNER_CAN_RESTORE });
        return;
      }
      const version = versions.find((v) => v.version_id === versionId);
      const idx = versions.findIndex((v) => v.version_id === versionId);
      const num = versions.length - idx;
      const vLabel = version?.content_snapshot?.label || `${UI_TEXT.VERSION} #${num}`;
      Modal.confirm({
        title: UI_TEXT.CONFIRM_RESTORE,
        content: `${UI_TEXT.RESTORE_CONFIRM_PREFIX}${vLabel}${UI_TEXT.RESTORE_CONFIRM_SUFFIX}`,
        okText: UI_TEXT.RESTORE,
        okButtonProps: { danger: true },
        cancelText: UI_TEXT.CANCEL,
        onOk: async () => {
          try {
            await restoreBoardVersion(id, versionId);
            Toast.success(UI_TEXT.RESTORE_SUCCESS);
            const data = await getBoard(id);
            setBoard(data);
            setTitle(data.title || '');
            setPreviewingVersion(null);
            previewBackupRef.current = null;
            lastAutoSnapshotRef.current = null;
            fetchVersions();
          } catch (e) {
            Toast.error(e.message || UI_TEXT.RESTORE_FAIL);
          }
        },
      });
    },
    [board?.owner_id, user?.user_id, id, versions, fetchVersions]
  );

  // Manual version save
  const handleManualSave = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    let label = '';

    Modal.confirm({
      title: UI_TEXT.SAVE_SNAPSHOT,
      content: (
        <Input
          placeholder={UI_TEXT.VERSION_LABEL_PLACEHOLDER}
          id="manual-version-label"
          maxLength={50}
          style={{ marginTop: 8 }}
          onPressEnter={() => {
            const btn = document.querySelector('.ant-modal-confirm-btns .ant-btn-primary');
            if (btn) btn.click();
          }}
        />
      ),
      okText: UI_TEXT.SAVE,
      cancelText: UI_TEXT.CANCEL,
      onOk: async () => {
        label = document.getElementById('manual-version-label')?.value?.trim() || UI_TEXT.MANUAL_SAVE_DEFAULT;

        setSavingManual(true);
        try {
          const snapshotStr = serializeCanvas(canvas);
          await createBoardVersion(id, {
            content_snapshot: {
              canvas: snapshotStr,
              title: title || UI_TEXT.UNTITLED_BOARD,
              type: 'manual_checkpoint',
              created_by: user?.user_id,
              label,
            },
          });
          lastAutoSnapshotRef.current = snapshotStr;
          lastAutoSaveTimeRef.current = Date.now();
          Toast.success(`${UI_TEXT.VERSION} "${label}" ${UI_TEXT.SAVE_SUCCESS}`);
          fetchVersions();
        } catch (e) {
          Toast.error(e.message || UI_TEXT.SAVE_FAIL);
        } finally {
          setSavingManual(false);
        }
      },
    });
  }, [id, title, user?.user_id, fetchVersions]);

  // Init
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBoard(id)
      .then((data) => {
        if (cancelled) return;
        setBoard(data);
        setTitle(data.title || '');
        fetchVersions();
      })
      .catch((e) => {
        Toast.error(e.message || UI_TEXT.LOAD_FAIL);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, fetchVersions]);

  // Fabric canvas init
  useEffect(() => {
    if (!canvasElRef.current) return;
    if (fabricRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      backgroundColor: '#fff',
      selection: true,
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;

    const ro = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      canvas.setWidth(Math.max(320, Math.floor(rect.width)));
      canvas.setHeight(Math.max(320, Math.floor(rect.height)));
      canvas.requestRenderAll();
    });
    if (containerRef.current) ro.observe(containerRef.current);

    const onObjectAdded = (opt) => {
      if (applyingRemoteRef.current) return;
      if (applyingYjsRef.current) return;
      const obj = opt?.target;
      if (!obj) return;
      const objectId = ensureObjectId(obj);
      if (objectId) objectIndexRef.current.set(objectId, obj);
      upsertYjsObjectFromFabric(obj);
      scheduleSyncAndSave();
    };

    const onObjectModified = (opt) => {
      if (applyingRemoteRef.current) return;
      if (applyingYjsRef.current) return;
      const obj = opt?.target;
      if (!obj) return;
      const objectId = ensureObjectId(obj);
      if (objectId) objectIndexRef.current.set(objectId, obj);
      upsertYjsObjectFromFabric(obj);
      scheduleSyncAndSave();
    };

    const onObjectRemoved = (opt) => {
      if (applyingRemoteRef.current) return;
      if (applyingYjsRef.current) return;
      const obj = opt?.target;
      const objectId = obj?.objectId || obj?.get?.('objectId');
      if (objectId) objectIndexRef.current.delete(objectId);
      if (objectId) deleteYjsObject(objectId);
      scheduleSyncAndSave();
    };

    const onPathCreated = (opt) => {
      if (applyingRemoteRef.current) return;
      if (applyingYjsRef.current) return;
      const obj = opt?.path;
      if (!obj) return;
      const objectId = ensureObjectId(obj);
      if (objectId) objectIndexRef.current.set(objectId, obj);
      upsertYjsObjectFromFabric(obj);
      scheduleSyncAndSave();
    };

    canvas.on('object:added', onObjectAdded);
    canvas.on('object:modified', onObjectModified);
    canvas.on('object:removed', onObjectRemoved);
    canvas.on('path:created', onPathCreated);

    return () => {
      ro.disconnect();
      canvas.off('object:added', onObjectAdded);
      canvas.off('object:modified', onObjectModified);
      canvas.off('object:removed', onObjectRemoved);
      canvas.off('path:created', onPathCreated);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [deleteYjsObject, ensureObjectId, scheduleSyncAndSave, upsertYjsObjectFromFabric]);

  // Tool switching
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = tool === TOOLS.PENCIL;
    canvas.selection = tool === TOOLS.SELECT;
    canvas.defaultCursor = tool === TOOLS.SELECT ? 'default' : 'crosshair';
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.freeDrawingBrush.width = strokeWidth;
    }

    const cleanupDrawing = () => {
      const drawing = drawingRef.current;
      drawing.isDown = false;
      drawing.startX = 0;
      drawing.startY = 0;
      if (drawing.tempObj) {
        canvas.remove(drawing.tempObj);
        drawing.tempObj = null;
      }
    };

    const getPointer = (opt) => canvas.getPointer(opt.e);

    const onMouseDown = (opt) => {
      if (toolRef.current === TOOLS.SELECT || toolRef.current === TOOLS.PENCIL) return;
      const { x, y } = getPointer(opt);
      const drawing = drawingRef.current;
      drawing.isDown = true;
      drawing.startX = x;
      drawing.startY = y;

      if (toolRef.current === TOOLS.RECT) {
        const rect = new fabric.Rect({
          left: x,
          top: y,
          width: 1,
          height: 1,
          fill: fillEnabled ? fillColor : 'transparent',
          stroke: strokeColor,
          strokeWidth,
        });
        drawing.tempObj = rect;
        canvas.add(rect);
        canvas.setActiveObject(rect);
      } else if (toolRef.current === TOOLS.CIRCLE) {
        const circle = new fabric.Ellipse({
          left: x,
          top: y,
          rx: 1,
          ry: 1,
          fill: fillEnabled ? fillColor : 'transparent',
          stroke: strokeColor,
          strokeWidth,
          originX: 'left',
          originY: 'top',
        });
        drawing.tempObj = circle;
        canvas.add(circle);
        canvas.setActiveObject(circle);
      } else if (toolRef.current === TOOLS.TEXT) {
        const text = new fabric.IText('文字', {
          left: x,
          top: y,
          fontSize: 20,
          fill: strokeColor,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        cleanupDrawing();
      } else if (toolRef.current === TOOLS.ARROW) {
        const line = new fabric.Line([x, y, x + 1, y + 1], {
          stroke: strokeColor,
          strokeWidth,
          selectable: false,
          evented: false,
        });
        const head = new fabric.Triangle({
          left: x,
          top: y,
          width: 12,
          height: 12,
          fill: strokeColor,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        const group = new fabric.Group([line, head], {
          left: 0,
          top: 0,
          selectable: true,
        });
        group._arrow = true;
        drawing.tempObj = group;
        canvas.add(group);
        canvas.setActiveObject(group);
      }
    };

    const onMouseMove = (opt) => {
      const drawing = drawingRef.current;
      if (!drawing.isDown) return;
      if (!drawing.tempObj) return;

      const { x, y } = getPointer(opt);
      const startX = drawing.startX;
      const startY = drawing.startY;

      if (toolRef.current === TOOLS.RECT) {
        const rect = drawing.tempObj;
        const left = Math.min(startX, x);
        const top = Math.min(startY, y);
        rect.set({
          left,
          top,
          width: Math.abs(x - startX),
          height: Math.abs(y - startY),
        });
        rect.setCoords();
        canvas.requestRenderAll();
      } else if (toolRef.current === TOOLS.CIRCLE) {
        const ellipse = drawing.tempObj;
        const left = Math.min(startX, x);
        const top = Math.min(startY, y);
        ellipse.set({
          left,
          top,
          rx: Math.abs(x - startX) / 2,
          ry: Math.abs(y - startY) / 2,
        });
        ellipse.setCoords();
        canvas.requestRenderAll();
      } else if (toolRef.current === TOOLS.ARROW) {
        const group = drawing.tempObj;
        const line = group._objects[0];
        const head = group._objects[1];
        line.set({ x1: startX, y1: startY, x2: x, y2: y });
        const angle = (Math.atan2(y - startY, x - startX) * 180) / Math.PI;
        head.set({ left: x, top: y, angle: angle + 90 });
        group.addWithUpdate();
        canvas.requestRenderAll();
      }
    };

    const onMouseUp = () => {
      const drawing = drawingRef.current;
      if (!drawing.isDown) return;
      drawing.isDown = false;
      drawing.startX = 0;
      drawing.startY = 0;

      if (drawing.tempObj) {
        drawing.tempObj = null;
      }

      if (toolRef.current !== TOOLS.SELECT && toolRef.current !== TOOLS.PENCIL) {
        setTool(TOOLS.SELECT);
      }
    };

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      cleanupDrawing();
    };
  }, [fillColor, fillEnabled, strokeColor, strokeWidth, tool]);

  /* ─────────────── 加载服务端数据到画布 ─────────────── */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (loading) return;
    if (!board) return;

    const ydoc = ydocRef.current;
    const yObjects = yObjectsRef.current;
    const persistedYjs = board.content_data?.yjs;
    const snapshotStr = board.content_data?.canvas;

    applyingRemoteRef.current = true;
    canvas.clear();
    canvas.setBackgroundColor('#fff', () => {});
    objectIndexRef.current = new Map();

    if (ydoc && yObjects && persistedYjs) {
      suppressYjsEmitRef.current = true;
      applyPersistedYjsState(ydoc, persistedYjs);
      suppressYjsEmitRef.current = false;
      setTimeout(() => {
        applyingRemoteRef.current = false;
        updateUndoState();
        lastAutoSnapshotRef.current = serializeCanvas(canvas);
        lastAutoSaveTimeRef.current = Date.now();
      }, 0);
      return;
    }

    if (snapshotStr) {
      const parsed = safeParseJson(snapshotStr);
      if (parsed) {
        canvas.loadFromJSON(parsed, () => {
          canvas.getObjects().forEach((obj) => {
            const objectId = ensureObjectId(obj);
            if (objectId) objectIndexRef.current.set(objectId, obj);
          });
          canvas.renderAll();
          applyingRemoteRef.current = false;
          takeSnapshot();
          lastAutoSnapshotRef.current = serializeCanvas(canvas);
          lastAutoSaveTimeRef.current = Date.now();

          if (ydoc && yObjects) {
            suppressYjsEmitRef.current = true;
            ydoc.transact(() => {
              Array.from(yObjects.keys()).forEach((key) => yObjects.delete(key));
              canvas.getObjects().forEach((obj) => {
                const objectId = ensureObjectId(obj);
                const jsonStr = serializeFabricObject(obj);
                if (objectId && jsonStr) yObjects.set(objectId, jsonStr);
              });
            }, 'bootstrap');
            suppressYjsEmitRef.current = false;
            updateUndoState();
          }
        });
      } else {
        applyingRemoteRef.current = false;
        takeSnapshot();
      }
    } else {
      applyingRemoteRef.current = false;
      takeSnapshot();
    }
  }, [board, ensureObjectId, loading, serializeFabricObject, takeSnapshot, updateUndoState]);

  // Auto checkpoint: if changed and interval >= 30s, create a version snapshot.
  useEffect(() => {
    if (!id || !board || loading) return;

    const timer = setInterval(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const now = Date.now();
      const snapshotStr = serializeCanvas(canvas);

      // 1. Has changed (compare with last checkpoint snapshot)
      const hasChanged = snapshotStr !== lastAutoSnapshotRef.current;

      // 2. Interval >= 30s
      const timeElapsed = now - lastAutoSaveTimeRef.current >= 30000;

      if (hasChanged && timeElapsed) {
        createBoardVersion(id, {
          content_snapshot: {
            canvas: snapshotStr,
            title: title || UI_TEXT.UNTITLED_BOARD,
            type: 'auto_checkpoint',
            created_by: user?.user_id,
          },
        })
          .then(() => {
            lastAutoSnapshotRef.current = snapshotStr;
            lastAutoSaveTimeRef.current = now;
            fetchVersions();
          })
          .catch(() => {});
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [id, board, loading, title, user?.user_id, fetchVersions]);

  // Socket events
  useEffect(() => {
    connect();

    const isConnected =
      socketStatus === SocketStatus.CONNECTED || socketStatus === SocketStatus.RECOVERED;
    if (isConnected && !joinedRef.current) {
      joinRoom(id);
      joinedRef.current = true;
    }

    if (isConnected && joinedRef.current && !requestedSyncRef.current) {
      requestedSyncRef.current = true;
      emit(SOCKET_EVENTS.BOARD_SYNC_REQUEST, { itemId: id });
    }

    const handleOperation = ({ itemId, update }) => {
      if (itemId !== id) return;
      if (!update) return;
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      try {
        Y.applyUpdate(ydoc, base64ToUint8(update), 'remote');
      } catch {}
    };

    const handleSyncRequest = ({ itemId, requesterSocketId }) => {
      if (itemId !== id) return;
      if (!requesterSocketId) return;
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      emit(SOCKET_EVENTS.BOARD_SYNC_RESPONSE, {
        itemId: id,
        requesterSocketId,
        update: uint8ToBase64(Y.encodeStateAsUpdate(ydoc)),
      });
    };

    const handleSyncResponse = ({ itemId, update }) => {
      if (itemId !== id) return;
      if (!update) return;
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      try {
        Y.applyUpdate(ydoc, base64ToUint8(update), 'remote');
      } catch {}
    };

    const handleCursor = ({ itemId, userId, x, y }) => {
      if (itemId !== id) return;
      if (!userId) return;
      if (user?.user_id && userId === user.user_id) return;
      setRemoteCursors((prev) => {
        const color = hashColor(String(userId));
        return {
          ...prev,
          [userId]: { x, y, color, updatedAt: Date.now() },
        };
      });
    };

    const handleUserLeft = ({ userId }) => {
      if (!userId) return;
      setRemoteCursors((prev) => {
        if (!prev[userId]) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const handleVersionRestored = ({ itemId: restoredItemId }) => {
      if (restoredItemId !== id) return;
      Toast.info(UI_TEXT.REMOTE_RESTORED);
      setTimeout(() => window.location.reload(), 1500);
    };

    on(SOCKET_EVENTS.BOARD_OPERATION, handleOperation);
    on(SOCKET_EVENTS.BOARD_SYNC_REQUEST, handleSyncRequest);
    on(SOCKET_EVENTS.BOARD_SYNC_RESPONSE, handleSyncResponse);
    on(SOCKET_EVENTS.BOARD_CURSOR, handleCursor);
    on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    on(SOCKET_EVENTS.BOARD_VERSION_RESTORED, handleVersionRestored);

    return () => {
      off(SOCKET_EVENTS.BOARD_OPERATION, handleOperation);
      off(SOCKET_EVENTS.BOARD_SYNC_REQUEST, handleSyncRequest);
      off(SOCKET_EVENTS.BOARD_SYNC_RESPONSE, handleSyncResponse);
      off(SOCKET_EVENTS.BOARD_CURSOR, handleCursor);
      off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
      off(SOCKET_EVENTS.BOARD_VERSION_RESTORED, handleVersionRestored);
      if (joinedRef.current) {
        leaveRoom(id);
        joinedRef.current = false;
      }
      requestedSyncRef.current = false;
    };
  }, [connect, emit, id, joinRoom, leaveRoom, off, on, socketStatus, user?.user_id]);

  // Cursor presence
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e) => {
      const now = Date.now();
      if (now - lastCursorSentAtRef.current < 50) return;
      lastCursorSentAtRef.current = now;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      emit(SOCKET_EVENTS.BOARD_CURSOR, { itemId: id, x, y });
    };
    el.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('mousemove', onMove);
    };
  }, [emit, id]);

  /* ─────────────── 清理过期远程光标 ─────────────── */
  useEffect(() => {
    const timer = setInterval(() => {
      setRemoteCursors((prev) => {
        const now = Date.now();
        const next = {};
        Object.entries(prev).forEach(([uid, cur]) => {
          if (now - cur.updatedAt < 6000) next[uid] = cur;
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  /* ─────────────── 渲染 ─────────────── */
  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Navbar />
      <Content style={{ padding: 16, display: 'flex', gap: 16 }}>
        {/* Main area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Card
            title={
              <Space size={12} wrap>
                <Typography.Text strong>{UI_TEXT.BOARD}</Typography.Text>
                {connectionTag}
                {dirty ? <Tag color="gold">{UI_TEXT.UNSAVED}</Tag> : <Tag color="default">{UI_TEXT.SAVED}</Tag>}
                {previewingVersion && (
                  <Tag color="orange" icon={<ClockCircleOutlined />}>
                    {UI_TEXT.PREVIEWING}
                  </Tag>
                )}
              </Space>
            }
            extra={
              <Space wrap>
                <Button
                  onClick={() => setSidebarOpen((v) => !v)}
                  type={sidebarOpen ? 'primary' : 'default'}
                >
                  {UI_TEXT.VERSION_HISTORY}
                </Button>
                <Button onClick={undo} disabled={!canUndo}>
                  {UI_TEXT.UNDO}
                </Button>
                <Button
                  onClick={redo}
                  disabled={!canRedo}
                >
                  {UI_TEXT.REDO}
                </Button>
                <Button danger onClick={deleteSelected}>
                  {UI_TEXT.DELETE}
                </Button>
                <Button onClick={exportPng}>{UI_TEXT.EXPORT_PNG}</Button>
                <Button type="primary" onClick={saveNow} disabled={!dirty}>
                  {UI_TEXT.SAVE}
                </Button>
                <Button 
                    type="default" 
                    icon={<ArrowLeftOutlined />} 
                    onClick={() => navigate('/')}
                >
                    {UI_TEXT.BACK_HOME}
                </Button>
              </Space>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, padding: 12, display: 'flex', flexDirection: 'column' } }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Space wrap>
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  placeholder={UI_TEXT.BOARD_TITLE}
                  style={{ width: 320 }}
                />
                <Tag>id: {id}</Tag>
              </Space>

              <Space wrap>
                <Button
                  type={tool === TOOLS.SELECT ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.SELECT)}
                >
                  {UI_TEXT.SELECT}
                </Button>
                <Button
                  type={tool === TOOLS.PENCIL ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.PENCIL)}
                >
                  {UI_TEXT.PENCIL}
                </Button>
                <Button
                  type={tool === TOOLS.RECT ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.RECT)}
                >
                  {UI_TEXT.RECT}
                </Button>
                <Button
                  type={tool === TOOLS.CIRCLE ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.CIRCLE)}
                >
                  {UI_TEXT.CIRCLE}
                </Button>
                <Button
                  type={tool === TOOLS.ARROW ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.ARROW)}
                >
                  {UI_TEXT.ARROW}
                </Button>
                <Button
                  type={tool === TOOLS.TEXT ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.TEXT)}
                >
                  {UI_TEXT.TEXT}
                </Button>
              </Space>

              <Space wrap align="center">
                <Space size={6} align="center">
                  <Typography.Text type="secondary">{UI_TEXT.STROKE}</Typography.Text>
                  <ColorPicker
                    value={strokeColor}
                    onChange={(_, hex) => setStrokeColor(hex)}
                    size="small"
                  />
                </Space>
                <Space size={6} align="center">
                  <Typography.Text type="secondary">{UI_TEXT.FILL}</Typography.Text>
                  <Button
                    size="small"
                    type={fillEnabled ? 'primary' : 'default'}
                    onClick={() => setFillEnabled((v) => !v)}
                  >
                    {fillEnabled ? UI_TEXT.ON : UI_TEXT.OFF}
                  </Button>
                  <ColorPicker
                    value={fillColor}
                    disabled={!fillEnabled}
                    onChange={(color) => setFillColor(color.toRgbString())}
                    size="small"
                  />
                </Space>
                <Space size={6} align="center" style={{ width: 220 }}>
                  <Typography.Text type="secondary">{UI_TEXT.STROKE_WIDTH}</Typography.Text>
                  <Slider
                    min={1}
                    max={20}
                    value={strokeWidth}
                    onChange={(v) => setStrokeWidth(v)}
                    style={{ width: 140 }}
                  />
                </Space>
              </Space>

              {/* Preview banner */}
              {previewingVersion && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#fff7e6',
                    border: '1px solid #ffd591',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Space>
                    <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                    <Typography.Text strong>{UI_TEXT.PREVIEW_BANNER}</Typography.Text>
                    <Typography.Text type="secondary">
                      {formatTime(previewingVersion.created_at)}
                    </Typography.Text>
                  </Space>
                  <Button size="small" onClick={handleExitPreview}>
                    {UI_TEXT.EXIT_PREVIEW}
                  </Button>
                </div>
              )}

              <div
                ref={containerRef}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 'calc(100vh - 260px)',
                  minHeight: 420,
                  background: '#fff',
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <canvas ref={canvasElRef} />
                {Object.entries(remoteCursors).map(([uid, cur]) => (
                  <div
                    key={uid}
                    style={{
                      position: 'absolute',
                      left: cur.x,
                      top: cur.y,
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      zIndex: 5,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: cur.color,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: '#555',
                        background: 'rgba(255,255,255,0.9)',
                        padding: '2px 6px',
                        borderRadius: 6,
                      }}
                    >
                      {String(uid).slice(0, 6)}
                    </span>
                  </div>
                ))}
                {loading ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.6)',
                      zIndex: 10,
                    }}
                  >
                    <Typography.Text>{UI_TEXT.LOADING}</Typography.Text>
                  </div>
                ) : null}
              </div>
            </Space>
          </Card>
        </div>

        {/* Version sidebar */}
        {sidebarOpen && (
          <Card
            title={
              <Space>
                <HistoryOutlined />
                <span>{UI_TEXT.VERSION_HISTORY}</span>
              </Space>
            }
            extra={
              <Space>
                <Tooltip title={UI_TEXT.TOOLTIP_SAVE_VERSION}>
                  <Button
                    type="primary"
                    size="small"
                    icon={<SaveOutlined />}
                    loading={savingManual}
                    onClick={handleManualSave}
                  >
                    {UI_TEXT.SAVE_VERSION}
                  </Button>
                </Tooltip>
                <Button type="text" icon={<CloseOutlined />} onClick={() => setSidebarOpen(false)} />
              </Space>
            }
            style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, overflowY: 'auto', padding: 12 } }}
          >
            {versions.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={UI_TEXT.NO_VERSIONS} />
            ) : (
              <List
                size="small"
                dataSource={versions}
                renderItem={(item, index) => {
                  const num = versions.length - index;
                  const isPreviewing = previewingVersion?.version_id === item.version_id;
                  const snapshot = item.content_snapshot || {};
                  const isManual = snapshot.type === 'manual_checkpoint';
                  const label = snapshot.label;

                  return (
                    <List.Item
                      style={{
                        background: isPreviewing ? '#e6f7ff' : 'transparent',
                        borderRadius: 6,
                        padding: '8px 12px',
                        marginBottom: 8,
                        cursor: 'pointer',
                        border: isPreviewing ? '1px solid #91d5ff' : '1px solid transparent',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => handlePreviewVersion(item)}
                      actions={[
                        <Tooltip title={UI_TEXT.TOOLTIP_PREVIEW} key="preview">
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewVersion(item);
                            }}
                          />
                        </Tooltip>,
                        board?.owner_id === user?.user_id ? (
                          <Tooltip title={UI_TEXT.TOOLTIP_RESTORE} key="restore">
                            <Button
                              type="text"
                              size="small"
                              icon={<RollbackOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreVersion(item.version_id);
                              }}
                            />
                          </Tooltip>
                        ) : null,
                      ].filter(Boolean)}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <span>{UI_TEXT.VERSION} #{num}</span>
                            {isManual ? (
                              <Tag
                                color="blue"
                                style={{ fontSize: 11, lineHeight: '16px', padding: '0 4px' }}
                              >
                                {UI_TEXT.MANUAL}
                              </Tag>
                            ) : (
                              <Tag
                                color="orange"
                                style={{ fontSize: 11, lineHeight: '16px', padding: '0 4px' }}
                              >
                                {UI_TEXT.AUTO}
                              </Tag>
                            )}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {formatTime(item.created_at)}
                            </Typography.Text>
                            {label && label !== UI_TEXT.MANUAL_SAVE_DEFAULT && (
                              <Typography.Text
                                style={{ fontSize: 12, color: '#1890ff' }}
                              >
                                {label}
                              </Typography.Text>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        )}
      </Content>
    </Layout>
  );
}

export default BoardPage;
