import { Layout, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';

/**
 * 文档编辑页。
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
 *     joinRoom(id);                     // 加入本文档的房间
 *     on('doc:operation', onOperation); // 监听他人的操作（OT/CRDT 等）
 *     on('doc:cursor', onCursor);       // 监听他人光标位置
 *     return () => {
 *       off('doc:operation', onOperation);
 *       off('doc:cursor', onCursor);
 *       leaveRoom(id);
 *     };
 *   }, [id]);
 *
 *   // 本地操作后广播
 *   emit('doc:operation', { op, rev });
 *   emit('doc:cursor', { position });
 */

// TODO: 后续补充文档编辑功能（富文本编辑器 + Socket 实时同步）
function DocPage() {
  const { id } = useParams();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar />
      <Layout.Content style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography.Title level={2}>文档编辑页（id: {id}）</Typography.Title>
      </Layout.Content>
    </Layout>
  );
}

export default DocPage;
