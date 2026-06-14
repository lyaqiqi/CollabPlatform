import { Layout, Typography, Space, Button, Card, Tag, Input, Modal, Empty, List, Tooltip } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import * as Y from 'yjs';
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
import { useBoardCollaboration } from '../hooks/useBoardCollaboration';
import { SocketStatus } from '../socket/useSocket';
import { applyPersistedYjsState, encodeYjsState } from '../collab/yjsUtils';
import { SOCKET_EVENTS } from '../utils/constants';

const { Content } = Layout;

const TOOLS = {
  SELECT: 'select',
  PENCIL: 'pencil',
  RECT: 'rect',
  CIRCLE: 'circle',
  ARROW: 'arrow',
  TEXT: 'text',
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

function ensureFabricId(obj) {
  if (!obj.__yjsId) {
    obj.__yjsId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  return obj.__yjsId;
}

function fabricToYjs(obj) {
  const json = obj.toJSON();
  json.__yjsId = obj.__yjsId;
  delete json.canvas;
  return json;
}

function yjsToFabric(data) {
  const { __yjsId, ...fabricData } = data;
  return new Promise((resolve) => {
    fabric.util.enlivenObjects([fabricData], ([obj]) => {
      if (obj) obj.__yjsId = __yjsId;
      resolve(obj);
    });
  });
}

function BoardPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const {
    ydoc,
    yObjects,
    yMeta,
    provider,
    connected,
    status: socketStatus,
    onlineUsers,
  } = useBoardCollaboration(id, user);

  const awareness = provider?.awareness;

  const containerRef = useRef(null);
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const applyingRemoteRef = useRef(false);
  const drawingRef = useRef({ isDown: false, startX: 0, startY: 0, tempObj: null });
  const toolRef = useRef(TOOLS.SELECT);
  const lastCursorSentAtRef = useRef(0);
  const initializedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState(null);
  const [tool, setTool] = useState(TOOLS.SELECT);
  const [title, setTitle] = useState('');
  const [dirty, setDirty] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [versions, setVersions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewingVersion, setPreviewingVersion] = useState(null);
  const [savingManual, setSavingManual] = useState(false);

  toolRef.current = tool;

  const localMapRef = useRef(new Map());

  const connectionTag = useMemo(() => {
    if (socketStatus === SocketStatus.CONNECTED || socketStatus === SocketStatus.RECOVERED) {
      return <Tag color="green">已连接</Tag>;
    }
    if (socketStatus === SocketStatus.CONNECTING) return <Tag color="blue">连接中</Tag>;
    if (socketStatus === SocketStatus.RECONNECTING) return <Tag color="orange">重连中</Tag>;
    return <Tag>未连接</Tag>;
  }, [socketStatus]);

  const fetchVersions = useCallback(async () => {
    try {
      const data = await listBoardVersions(id);
      setVersions(data);
    } catch (e) {
      console.error('获取版本列表失败', e);
    }
  }, [id]);

  // ========== 加载白板数据 ==========
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
        Toast.error(e.message || '白板加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, fetchVersions]);

  // ========== 标题同步 ==========
  useEffect(() => {
    if (!yMeta) return;
    yMeta.set('title', title);
  }, [title, yMeta]);

  useEffect(() => {
    if (!yMeta) return;
    const handler = () => {
      const remoteTitle = yMeta.get('title');
      if (remoteTitle && remoteTitle !== title) {
        setTitle(remoteTitle);
      }
    };
    yMeta.observe(handler);
    return () => yMeta.unobserve(handler);
  }, [yMeta, title]);

  // ========== Fabric 画布初始化 ==========
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

    return () => {
      ro.disconnect();
      canvas.dispose();
      fabricRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  // ========== 组件卸载清理 ==========
  useEffect(() => {
    return () => {
      initializedRef.current = false;
      localMapRef.current.clear();
    };
  }, [id]);

  // ========== 数据迁移（修复闭包陷阱）==========
  const boardRef = useRef(null);
  const migratedRef = useRef(false);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    if (!ydoc || !board?.content_data?.canvas) return;
    if (migratedRef.current) return;

    const yObjects = ydoc.getArray('objects');
    if (yObjects.length > 0) {
      migratedRef.current = true;
      return;
    }

    const snapshotStr = board.content_data.canvas;
    console.log('[Board] 尝试迁移数据');

    try {
      const parsed = JSON.parse(snapshotStr);
      if (parsed?.objects?.length > 0) {
        ydoc.transact(() => {
          parsed.objects.forEach((objData) => {
            const yMap = new Y.Map();
            const yjsId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            yMap.set('__yjsId', yjsId);
            Object.entries(objData).forEach(([k, v]) => {
              if (k !== '__yjsId') yMap.set(k, v);
            });
            yObjects.push([yMap]);
          });
        }, 'persisted');
        console.log('[Board] 从旧 JSON 迁移完成，对象数:', parsed.objects.length);
        migratedRef.current = true;
        return;
      }
    } catch {
      // 不是 JSON
    }

    try {
      applyPersistedYjsState(ydoc, snapshotStr);
      console.log('[Board] 从 Yjs base64 恢复完成');
      migratedRef.current = true;
    } catch (e) {
      console.error('[Board] 迁移失败:', e);
    }
  }, [ydoc, board]); // ✅ 关键：加上 board

  // ========== Yjs <-> Fabric 双向绑定 ==========
  useEffect(() => {
    if (!yObjects || !fabricRef.current) return;
    if (initializedRef.current) return;

    const canvas = fabricRef.current;
    const localMap = localMapRef.current;

    console.log('[Board] Yjs-Fabric 绑定开始, yObjects.length:', yObjects.length);

    const handleYjsChange = async (events, transaction) => {
      if (applyingRemoteRef.current) return;
      // if (transaction && transaction.local) return;

      applyingRemoteRef.current = true;

      const yjsIds = new Set();
      const yjsArray = yObjects.toArray();
      yjsArray.forEach((yMap) => {
        const yjsId = yMap.get('__yjsId');
        if (yjsId) yjsIds.add(yjsId);
      });

      const toRemove = [];
      canvas.getObjects().forEach((obj) => {
        const yjsId = obj.__yjsId;
        if (yjsId && !yjsIds.has(yjsId)) {
          toRemove.push(obj);
          localMap.delete(yjsId);
        }
      });
      toRemove.forEach((obj) => canvas.remove(obj));

      for (let i = 0; i < yjsArray.length; i++) {
        const yMap = yjsArray[i];
        const data = yMap.toJSON();
        const yjsId = data.__yjsId;
        if (!yjsId) continue;

        let obj = localMap.get(yjsId);
        if (!obj) {
          obj = await yjsToFabric(data);
          if (!obj) continue;
          localMap.set(yjsId, obj);
          canvas.add(obj);
          obj.moveTo(i);
        } else {
          const { __yjsId: _, ...newProps } = data;
          obj.set(newProps);
          obj.setCoords();
          const currentIdx = canvas.getObjects().indexOf(obj);
          if (currentIdx !== i) {
            obj.moveTo(i);
          }
        }
      }

      canvas.requestRenderAll();
      applyingRemoteRef.current = false;
      console.log('[Board] Yjs -> Fabric 同步完成, 对象数:', canvas.getObjects().length);
    };

    yObjects.observe(handleYjsChange);

    const syncToYjs = () => {
      if (applyingRemoteRef.current) return;
      if (!yObjects) return;

      const canvasObjects = canvas.getObjects();
      const currentIds = new Set();

      canvasObjects.forEach((obj, index) => {
        const yjsId = ensureFabricId(obj);
        currentIds.add(yjsId);

        let yMap = null;
        const arr = yObjects.toArray();
        for (let i = 0; i < arr.length; i++) {
          if (arr[i].get('__yjsId') === yjsId) {
            yMap = arr[i];
            break;
          }
        }

        const data = fabricToYjs(obj);

        if (!yMap) {
          yMap = new Y.Map();
          Object.entries(data).forEach(([k, v]) => yMap.set(k, v));
          yObjects.push([yMap]);
        } else {
          const existing = yMap.toJSON();
          Object.entries(data).forEach(([k, v]) => {
            if (JSON.stringify(existing[k]) !== JSON.stringify(v)) {
              yMap.set(k, v);
            }
          });
          const currentIndex = arr.findIndex((m) => m.get('__yjsId') === yjsId);
          if (currentIndex !== -1 && currentIndex !== index) {
            const yMapToMove = yObjects.get(currentIndex);
            yObjects.delete(currentIndex);
            yObjects.insert(index, [yMapToMove]);
          }
        }
      });

      const arr = yObjects.toArray();
      for (let i = arr.length - 1; i >= 0; i--) {
        const yjsId = arr[i].get('__yjsId');
        if (!currentIds.has(yjsId)) {
          yObjects.delete(i);
        }
      }
    };

    let syncTimer = null;
    const scheduleSync = () => {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        syncToYjs();
        setDirty(true);
        syncTimer = null;
      }, 50);
    };

    canvas.on('object:added', scheduleSync);
    canvas.on('object:modified', scheduleSync);
    canvas.on('object:removed', scheduleSync);
    canvas.on('object:moving', scheduleSync);
    canvas.on('path:created', (e) => {
      ensureFabricId(e.path);
      scheduleSync();
    });

    if (yObjects.length > 0) {
      console.log('[Board] 强制初始渲染, yObjects.length:', yObjects.length);
      handleYjsChange();
    }

    initializedRef.current = true;

    return () => {
      yObjects.unobserve(handleYjsChange);
      canvas.off('object:added', scheduleSync);
      canvas.off('object:modified', scheduleSync);
      canvas.off('object:removed', scheduleSync);
      canvas.off('object:moving', scheduleSync);
      canvas.off('path:created', scheduleSync);
      if (syncTimer) clearTimeout(syncTimer);
    };
  }, [yObjects, ydoc]);

  // ========== 工具切换 ==========
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = tool === TOOLS.PENCIL;
    canvas.selection = tool === TOOLS.SELECT;
    canvas.defaultCursor = tool === TOOLS.SELECT ? 'default' : 'crosshair';

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
          fill: 'rgba(24, 144, 255, 0.15)',
          stroke: '#1890ff',
          strokeWidth: 2,
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
          fill: 'rgba(82, 196, 26, 0.15)',
          stroke: '#52c41a',
          strokeWidth: 2,
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
          fill: '#111',
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        cleanupDrawing();
      } else if (toolRef.current === TOOLS.ARROW) {
        const line = new fabric.Line([x, y, x + 1, y + 1], {
          stroke: '#fa541c',
          strokeWidth: 3,
          selectable: false,
          evented: false,
        });
        const head = new fabric.Triangle({
          left: x,
          top: y,
          width: 12,
          height: 12,
          fill: '#fa541c',
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
        ensureFabricId(drawing.tempObj);
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
  }, [tool]);

  // ========== 光标同步 ==========
  useEffect(() => {
    if (!awareness || !containerRef.current) return;

    const el = containerRef.current;
    const onMove = (e) => {
      const now = Date.now();
      if (now - lastCursorSentAtRef.current < 50) return;
      lastCursorSentAtRef.current = now;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      awareness.setLocalStateField('cursor', { x, y });
    };
    el.addEventListener('mousemove', onMove);

    const handleAwarenessChange = () => {
      const states = Array.from(awareness.getStates().entries());
      const cursors = {};
      states.forEach(([clientId, state]) => {
        if (clientId === awareness.clientID) return;
        if (!state?.cursor) return;
        const color = state.user?.color || hashColor(String(clientId));
        cursors[clientId] = {
          x: state.cursor.x,
          y: state.cursor.y,
          color,
          name: state.user?.name || String(clientId).slice(0, 6),
          updatedAt: Date.now(),
        };
      });
      setRemoteCursors(cursors);
    };

    awareness.on('change', handleAwarenessChange);
    handleAwarenessChange();

    return () => {
      el.removeEventListener('mousemove', onMove);
      awareness.off('change', handleAwarenessChange);
    };
  }, [awareness]);

  // ========== 清理过期光标 ==========
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

  // ========== 操作函数 ==========
  const saveNow = useCallback(() => {
    if (!ydoc) return;
    const snapshotStr = encodeYjsState(ydoc);
    updateBoard(id, { title, content_data: { canvas: snapshotStr } })
      .then(() => {
        setDirty(false);
        Toast.success('已保存');
      })
      .catch((e) => Toast.error(e.message || '保存失败'));
  }, [id, title, ydoc]);

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
  }, []);

  const undoManagerRef = useRef(null);

  useEffect(() => {
    if (!yObjects) return;
    const um = new Y.UndoManager(yObjects);
    undoManagerRef.current = um;
    return () => um.destroy();
  }, [yObjects]);

  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    undoManagerRef.current?.redo();
  }, []);

  const previewBackupRef = useRef(null);

  const handlePreviewVersion = useCallback(
    (version) => {
      if (!ydoc) return;
      const snapshot = version.content_snapshot;
      if (!snapshot?.canvas) {
        Toast.error('该版本没有可预览的内容');
        return;
      }
      if (!previewingVersion) {
        previewBackupRef.current = encodeYjsState(ydoc);
      }
      setPreviewingVersion(version);
      applyingRemoteRef.current = true;
      applyPersistedYjsState(ydoc, snapshot.canvas);
      applyingRemoteRef.current = false;
    },
    [previewingVersion, ydoc]
  );

  const handleExitPreview = useCallback(() => {
    if (!ydoc) return;
    setPreviewingVersion(null);
    const backup = previewBackupRef.current;
    if (backup) {
      applyingRemoteRef.current = true;
      applyPersistedYjsState(ydoc, backup);
      applyingRemoteRef.current = false;
      previewBackupRef.current = null;
    }
  }, [ydoc]);

  const handleRestoreVersion = useCallback(
    (versionId) => {
      if (board?.owner_id !== user?.user_id) {
        Modal.warning({ title: '权限不足', content: '仅白板所有者可恢复版本' });
        return;
      }
      const version = versions.find((v) => v.version_id === versionId);
      const idx = versions.findIndex((v) => v.version_id === versionId);
      const num = versions.length - idx;
      const vLabel = version?.content_snapshot?.label || `版本 #${num}`;
      Modal.confirm({
        title: '确认恢复版本',
        content: `恢复后白板内容将回滚到 ${vLabel}，当前内容将被覆盖。确定继续？`,
        okText: '恢复',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          try {
            await restoreBoardVersion(id, versionId);
            Toast.success('版本恢复成功');
            const data = await getBoard(id);
            setBoard(data);
            setTitle(data.title || '');
            setPreviewingVersion(null);
            previewBackupRef.current = null;
            fetchVersions();
          } catch (e) {
            Toast.error(e.message || '恢复失败');
          }
        },
      });
    },
    [board?.owner_id, user?.user_id, id, versions, fetchVersions]
  );

  const handleManualSave = useCallback(() => {
    if (!ydoc) return;
    let label = '';

    Modal.confirm({
      title: '保存版本快照',
      content: (
        <Input
          placeholder="版本备注（可选）"
          id="manual-version-label"
          maxLength={50}
          style={{ marginTop: 8 }}
          onPressEnter={() => {
            const btn = document.querySelector('.ant-modal-confirm-btns .ant-btn-primary');
            if (btn) btn.click();
          }}
        />
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        label = document.getElementById('manual-version-label')?.value?.trim() || '手动保存';
        setSavingManual(true);
        try {
          const snapshotStr = encodeYjsState(ydoc);
          await createBoardVersion(id, {
            content_snapshot: {
              canvas: snapshotStr,
              title: title || '未命名白板',
              type: 'manual_checkpoint',
              created_by: user?.user_id,
              label,
            },
          });
          Toast.success(`版本"${label}"已保存`);
          fetchVersions();
          setDirty(false);
        } catch (e) {
          Toast.error(e.message || '保存失败');
        } finally {
          setSavingManual(false);
        }
      },
    });
  }, [id, title, user?.user_id, ydoc, fetchVersions]);

  useEffect(() => {
    if (!id || !board || !ydoc) return;

    const timer = setInterval(() => {
      const snapshotStr = encodeYjsState(ydoc);
      const currentSaved = board.content_data?.canvas;
      if (snapshotStr !== currentSaved) {
        createBoardVersion(id, {
          content_snapshot: {
            canvas: snapshotStr,
            title: title || '未命名白板',
            type: 'auto_checkpoint',
            created_by: user?.user_id,
          },
        })
          .then(() => fetchVersions())
          .catch(() => {});
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [id, board, ydoc, title, user?.user_id, fetchVersions]);

  // ========== 渲染 ==========
  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Navbar />
      <Content style={{ padding: 16, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Card
            title={
              <Space size={12} wrap>
                <Typography.Text strong>白板</Typography.Text>
                {connectionTag}
                {dirty ? <Tag color="gold">未保存</Tag> : <Tag color="default">已保存</Tag>}
                {previewingVersion && (
                  <Tag color="orange" icon={<ClockCircleOutlined />}>
                    预览中
                  </Tag>
                )}
                {onlineUsers.length > 0 && (
                  <Tag color="blue">{onlineUsers.length} 人在线</Tag>
                )}
              </Space>
            }
            extra={
              <Space wrap>
                <Button
                  onClick={() => setSidebarOpen((v) => !v)}
                  type={sidebarOpen ? 'primary' : 'default'}
                >
                  版本历史
                </Button>
                <Button onClick={undo}>撤销</Button>
                <Button onClick={redo}>重做</Button>
                <Button danger onClick={deleteSelected}>
                  删除
                </Button>
                <Button onClick={exportPng}>导出 PNG</Button>
                <Button type="primary" onClick={saveNow} disabled={!dirty}>
                  保存
                </Button>
                <Button
                  type="default"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate('/')}
                >
                  回到主界面
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
                  placeholder="白板标题"
                  style={{ width: 320 }}
                />
                <Tag>id: {id}</Tag>
              </Space>

              <Space wrap>
                <Button
                  type={tool === TOOLS.SELECT ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.SELECT)}
                >
                  选择
                </Button>
                <Button
                  type={tool === TOOLS.PENCIL ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.PENCIL)}
                >
                  画笔
                </Button>
                <Button
                  type={tool === TOOLS.RECT ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.RECT)}
                >
                  矩形
                </Button>
                <Button
                  type={tool === TOOLS.CIRCLE ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.CIRCLE)}
                >
                  圆形
                </Button>
                <Button
                  type={tool === TOOLS.ARROW ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.ARROW)}
                >
                  箭头
                </Button>
                <Button
                  type={tool === TOOLS.TEXT ? 'primary' : 'default'}
                  onClick={() => setTool(TOOLS.TEXT)}
                >
                  文字
                </Button>
              </Space>

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
                    <Typography.Text strong>正在预览历史版本</Typography.Text>
                    <Typography.Text type="secondary">
                      {formatTime(previewingVersion.created_at)}
                    </Typography.Text>
                  </Space>
                  <Button size="small" onClick={handleExitPreview}>
                    退出预览
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
                      {cur.name?.slice(0, 6) || String(uid).slice(0, 6)}
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
                    <Typography.Text>加载中...</Typography.Text>
                  </div>
                ) : null}
              </div>
            </Space>
          </Card>
        </div>

        {sidebarOpen && (
          <Card
            title={
              <Space>
                <HistoryOutlined />
                <span>版本历史</span>
              </Space>
            }
            extra={
              <Space>
                <Tooltip title="手动保存当前版本">
                  <Button
                    type="primary"
                    size="small"
                    icon={<SaveOutlined />}
                    loading={savingManual}
                    onClick={handleManualSave}
                  >
                    保存版本
                  </Button>
                </Tooltip>
                <Button type="text" icon={<CloseOutlined />} onClick={() => setSidebarOpen(false)} />
              </Space>
            }
            style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, overflowY: 'auto', padding: 12 } }}
          >
            {versions.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无版本快照" />
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
                        <Tooltip title="预览" key="preview">
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
                          <Tooltip title="恢复到此版本" key="restore">
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
                            <span>版本 #{num}</span>
                            {isManual ? (
                              <Tag
                                color="blue"
                                style={{ fontSize: 11, lineHeight: '16px', padding: '0 4px' }}
                              >
                                手动
                              </Tag>
                            ) : (
                              <Tag
                                color="orange"
                                style={{ fontSize: 11, lineHeight: '16px', padding: '0 4px' }}
                              >
                                自动
                              </Tag>
                            )}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {formatTime(item.created_at)}
                            </Typography.Text>
                            {label && label !== '手动保存' && (
                              <Typography.Text style={{ fontSize: 12, color: '#1890ff' }}>
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