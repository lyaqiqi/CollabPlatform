import { Layout, Typography, Space, Button, Card, Tag, Input, Modal, Empty, List, Tooltip } from 'antd';
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
  const saveTimerRef = useRef(null);
  const syncTimerRef = useRef(null);
  const historyRef = useRef({ stack: [], index: -1 });
  const previewBackupRef = useRef(null);
  const lastAutoSnapshotRef = useRef(null);   // ← 上次自动保存的快照内容
  const lastAutoSaveTimeRef = useRef(0);      // ← 上次自动保存的时间戳
  const navigate = useNavigate();

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

  toolRef.current = tool;

  const connectionTag = useMemo(() => {
    if (socketStatus === SocketStatus.CONNECTED || socketStatus === SocketStatus.RECOVERED) {
      return <Tag color="green">已连接</Tag>;
    }
    if (socketStatus === SocketStatus.CONNECTING) return <Tag color="blue">连接中</Tag>;
    if (socketStatus === SocketStatus.RECONNECTING) return <Tag color="orange">重连中</Tag>;
    return <Tag>未连接</Tag>;
  }, [socketStatus]);

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
        if (emitSync) {
          emit(SOCKET_EVENTS.BOARD_SYNC, { itemId: id, canvas: snapshotStr });
        }
        if (save) {
          setDirty(true);
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            updateBoard(id, { title, content_data: { canvas: snapshotStr } }).catch(() => {});
            setDirty(false);
          }, 1200);
        }
      });
    },
    [emit, id, title]
  );

  const scheduleSyncAndSave = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (applyingRemoteRef.current) return;

    setDirty(true);

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const snapshotStr = serializeCanvas(canvas);
      emit(SOCKET_EVENTS.BOARD_SYNC, { itemId: id, canvas: snapshotStr });
    }, 120);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const snapshotStr = serializeCanvas(canvas);
      updateBoard(id, { title, content_data: { canvas: snapshotStr } }).catch(() => {});
      setDirty(false);
    }, 1200);
  }, [emit, id, title]);

  const saveNow = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const snapshotStr = serializeCanvas(canvas);
    updateBoard(id, { title, content_data: { canvas: snapshotStr } })
      .then(() => {
        setDirty(false);
        Toast.success('已保存');
      })
      .catch((e) => Toast.error(e.message || '保存失败'));
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
    const { stack, index } = historyRef.current;
    if (index <= 0) return;
    historyRef.current = { stack, index: index - 1 };
    applySnapshot(stack[index - 1]);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const { stack, index } = historyRef.current;
    if (index >= stack.length - 1) return;
    historyRef.current = { stack, index: index + 1 };
    applySnapshot(stack[index + 1]);
  }, [applySnapshot]);

  /* ─────────────── 版本快照相关 ─────────────── */
  const fetchVersions = useCallback(async () => {
    try {
      const data = await listBoardVersions(id);
      setVersions(data);
    } catch (e) {
      console.error('获取版本列表失败', e);
    }
  }, [id]);

  const handlePreviewVersion = useCallback(
    (version) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const snapshot = version.content_snapshot;
      if (!snapshot?.canvas) {
        Toast.error('该版本没有可预览的内容');
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
            lastAutoSnapshotRef.current = null;   // ← 重置自动保存基准
            fetchVersions();
          } catch (e) {
            Toast.error(e.message || '恢复失败');
          }
        },
      });
    },
    [board?.owner_id, user?.user_id, id, versions, fetchVersions]
  );

  /* ─────────────── 手动保存版本 ─────────────── */
  const handleManualSave = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

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
          const snapshotStr = serializeCanvas(canvas);
          await createBoardVersion(id, {
            content_snapshot: {
              canvas: snapshotStr,
              title: title || '未命名白板',
              type: 'manual_checkpoint',
              created_by: user?.user_id,
              label,
            },
          });
          // 更新自动保存基准，避免手动保存后立即又自动保存
          lastAutoSnapshotRef.current = snapshotStr;
          lastAutoSaveTimeRef.current = Date.now();
          Toast.success(`版本"${label}"已保存`);
          fetchVersions();
        } catch (e) {
          Toast.error(e.message || '保存失败');
        } finally {
          setSavingManual(false);
        }
      },
    });
  }, [id, title, user?.user_id, fetchVersions]);

  /* ─────────────── 初始化：加载白板 & 版本列表 ─────────────── */
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

  /* ─────────────── Fabric 画布初始化 ─────────────── */
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

    const onChanged = () => {
      if (applyingRemoteRef.current) return;
      takeSnapshot();
      scheduleSyncAndSave();
    };

    canvas.on('object:added', onChanged);
    canvas.on('object:modified', onChanged);
    canvas.on('object:removed', onChanged);
    canvas.on('path:created', onChanged);

    return () => {
      ro.disconnect();
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [scheduleSyncAndSave, takeSnapshot]);

  /* ─────────────── 工具切换 ─────────────── */
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

  /* ─────────────── 加载服务端数据到画布 ─────────────── */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (loading) return;
    if (!board) return;

    const snapshotStr = board.content_data?.canvas;
    if (snapshotStr) {
      const parsed = safeParseJson(snapshotStr);
      if (parsed) {
        applyingRemoteRef.current = true;
        canvas.loadFromJSON(parsed, () => {
          canvas.renderAll();
          applyingRemoteRef.current = false;
          takeSnapshot();
          // 初始化自动保存基准
          lastAutoSnapshotRef.current = serializeCanvas(canvas);
          lastAutoSaveTimeRef.current = Date.now();
        });
      } else {
        takeSnapshot();
      }
    } else {
      takeSnapshot();
    }
  }, [board, loading, takeSnapshot]);

  /* ─────────────── 智能自动保存：有变更且间隔≥30秒才保存 ─────────────── */
  useEffect(() => {
    if (!id || !board || loading) return;

    const timer = setInterval(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const now = Date.now();
      const snapshotStr = serializeCanvas(canvas);

      // 1. 检查是否有变更（与上次自动保存的快照对比）
      const hasChanged = snapshotStr !== lastAutoSnapshotRef.current;

      // 2. 检查是否达到最小间隔（30秒）
      const timeElapsed = now - lastAutoSaveTimeRef.current >= 30000;

      // 只有同时满足：有变更 + 间隔≥30秒，才保存
      if (hasChanged && timeElapsed) {
        createBoardVersion(id, {
          content_snapshot: {
            canvas: snapshotStr,
            title: title || '未命名白板',
            type: 'auto_checkpoint',
            created_by: user?.user_id,
          },
        })
          .then(() => {
            // 更新基准
            lastAutoSnapshotRef.current = snapshotStr;
            lastAutoSaveTimeRef.current = now;
            fetchVersions();
          })
          .catch(() => {});
      }
    }, 5000); // 每5秒检查一次，而不是30秒，这样更灵敏

    return () => clearInterval(timer);
  }, [id, board, loading, title, user?.user_id, fetchVersions]);

  /* ─────────────── Socket 连接 & 事件监听 ─────────────── */
  useEffect(() => {
    connect();

    const isConnected =
      socketStatus === SocketStatus.CONNECTED || socketStatus === SocketStatus.RECOVERED;
    if (isConnected && !joinedRef.current) {
      joinRoom(id);
      joinedRef.current = true;
    }

    const handleSync = ({ canvas, userId, itemId }) => {
      if (itemId !== id) return;
      if (!canvas) return;
      applySnapshot(canvas, { emitSync: false, save: false });
      if (userId) {
        setRemoteCursors((prev) => {
          const next = { ...prev };
          if (!next[userId]) return prev;
          return next;
        });
      }
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
      Toast.info('白板版本已被恢复，正在同步最新内容...');
      getBoard(id)
        .then((data) => {
          setBoard(data);
          setTitle(data.title || '');
          // 恢复后重置自动保存基准
          lastAutoSnapshotRef.current = null;
          lastAutoSaveTimeRef.current = 0;
        })
        .catch(() => {});
    };

    on(SOCKET_EVENTS.BOARD_SYNC, handleSync);
    on(SOCKET_EVENTS.BOARD_CURSOR, handleCursor);
    on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    on(SOCKET_EVENTS.BOARD_VERSION_RESTORED, handleVersionRestored);

    return () => {
      off(SOCKET_EVENTS.BOARD_SYNC, handleSync);
      off(SOCKET_EVENTS.BOARD_CURSOR, handleCursor);
      off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
      off(SOCKET_EVENTS.BOARD_VERSION_RESTORED, handleVersionRestored);
      if (joinedRef.current) {
        leaveRoom(id);
        joinedRef.current = false;
      }
    };
  }, [applySnapshot, connect, id, joinRoom, leaveRoom, off, on, socketStatus, user?.user_id]);

  /* ─────────────── 鼠标光标实时同步 ─────────────── */
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
        {/* 左侧主区域 */}
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
                <Button onClick={undo} disabled={historyRef.current.index <= 0}>
                  撤销
                </Button>
                <Button
                  onClick={redo}
                  disabled={historyRef.current.index >= historyRef.current.stack.length - 1}
                >
                  重做
                </Button>
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

              {/* 预览提示条 */}
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
                    <Typography.Text>加载中...</Typography.Text>
                  </div>
                ) : null}
              </div>
            </Space>
          </Card>
        </div>

        {/* 右侧版本历史侧边栏 */}
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