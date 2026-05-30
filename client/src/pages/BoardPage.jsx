import { Layout, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';

/**
 * 白板编辑页 — 由 B 实现。
 *
 * 实时协作接入指南（使用 useSocket）：
 *
 *   import { useSocket } from '../socket/useSocket';
 *   import { SOCKET_EVENTS } from '../utils/constants';
 *
 *   const { connect, joinRoom, leaveRoom, emit, on, off } = useSocket();
 *
 *   useEffect(() => {
 *     connect();
 *     joinRoom(id);               // 加入本白板的房间
 *     on('board:draw', onDraw);   // 监听他人的笔迹
 *     return () => {
 *       off('board:draw', onDraw);
 *       leaveRoom(id);
 *     };
 *   }, [id]);
 *
 *   // 本地绘制后广播给其他人
 *   emit('board:draw', { path, color, width });
 */

// TODO: 由 B 实现白板编辑功能（Canvas 绘图 + Socket 实时同步）
function BoardPage() {
  const { id } = useParams();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar />
      <Layout.Content style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography.Title level={2}>白板编辑页（id: {id}）— 由 B 实现</Typography.Title>
      </Layout.Content>
    </Layout>
  );
}

export default BoardPage;
