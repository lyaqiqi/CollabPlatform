import { RouterProvider } from 'react-router-dom';
import { Alert, Button } from 'antd';
import { useEffect, useState } from 'react';
import router from './router/index';
import useAuthStore from './store/authStore';
import { useSocket, SocketStatus } from './socket/useSocket';

function ConnectionBanner() {
  const { status, initialized, connect } = useSocket();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    if (status === SocketStatus.DISCONNECTED && accessToken) {
      const timer = setTimeout(() => {
        console.log('[socket] 断线后自动重试连接');
        connect();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, accessToken, connect]);

  useEffect(() => {
    if (status === SocketStatus.RECOVERED) {
      setShowRecovered(true);
      const timer = setTimeout(() => {
        setShowRecovered(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (!accessToken || !initialized) return null;

  if (status === SocketStatus.DISCONNECTED) {
    return (
      <Alert
        message="WebSocket 已断开"
        type="warning"
        showIcon
        banner
        action={
          <Button type="link" onClick={connect}>
            立即重试
          </Button>
        }
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

  if (status === SocketStatus.RECOVERED && showRecovered) {
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