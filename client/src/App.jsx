import { RouterProvider } from 'react-router-dom';
import { Alert } from 'antd';
import { useEffect } from 'react';
import router from './router/index';
import useAuthStore from './store/authStore';
import { useSocket, SocketStatus } from './socket/useSocket';

/**
 * 全局连接状态提示条
 */
function ConnectionBanner() {
  const { status, initialized } = useSocket();
  const accessToken = useAuthStore((s) => s.accessToken);

  // 未登录时不显示连接状态（socket 本就没有连接）
  if (!accessToken) return null;

  // 尚未建立过 socket 实例时，不应提示“已断开”（避免误报）
  if (!initialized) return null;

  if (status === SocketStatus.DISCONNECTED) {
    return (
      <Alert
        message="WebSocket 已断开"
        type="warning"
        showIcon
        banner
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
      />
    );
  }
  if (status === SocketStatus.RECONNECTING) {
    return (
      <Alert
        message="正在重新连接..."
        type="info"
        showIcon
        banner
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
      />
    );
  }
  if (status === SocketStatus.RECOVERED) {
    return (
      <Alert
        message="连接已恢复"
        type="success"
        showIcon
        banner
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
      />
    );
  }
  return null;
}

function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  // 启动时恢复登录态
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <>
      <ConnectionBanner />
      <RouterProvider router={router} />
    </>
  );
}

export default App;
