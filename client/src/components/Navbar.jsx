import { Layout, Button, Typography, Space, Badge, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { useSocket, SocketStatus } from '../socket/useSocket';

const { Header } = Layout;
const { Text, Title } = Typography;

function ConnectionDot() {
  const { status, initialized, connect } = useSocket();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    if (status === SocketStatus.DISCONNECTED && accessToken) {
      const timer = setTimeout(() => connect(), 3000);
      return () => clearTimeout(timer);
    }
  }, [status, accessToken, connect]);

  useEffect(() => {
    if (status === SocketStatus.RECOVERED) {
      setShowRecovered(true);
      const timer = setTimeout(() => setShowRecovered(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (!accessToken || !initialized) return null;

  const statusConfig = {
    [SocketStatus.CONNECTED]: { color: 'success', text: '已连接' },
    [SocketStatus.CONNECTING]: { color: 'processing', text: '连接中' },
    [SocketStatus.RECONNECTING]: { color: 'warning', text: '重连中' },
    [SocketStatus.RECOVERED]: { color: 'success', text: showRecovered ? '已恢复' : '已连接' },
    [SocketStatus.DISCONNECTED]: { color: 'error', text: '已断开' },
  };

  const config = statusConfig[status];
  if (!config) return null;

  return (
    <Tooltip title={`WebSocket ${config.text}`} placement="bottom">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: status === SocketStatus.DISCONNECTED ? 'pointer' : 'default',
        }}
        onClick={status === SocketStatus.DISCONNECTED ? connect : undefined}
      >
        <Badge status={config.color} />
        <Text style={{ fontSize: 12, color: '#888' }}>{config.text}</Text>
      </div>
    </Tooltip>
  );
}

function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <Header
      style={{
        height: 72,
        padding: '0 32px',
        background: '#ffffff',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Title level={4} style={{ margin: 0, color: 'rgba(0,0,0,0.92)' }}>
            CollabPlatform
          </Title>
          <Text type="secondary">多人实时协作平台</Text>
        </div>
        <ConnectionDot />
      </div>
      <Space size={16} align="center">
        {user ? <Text>{user.username}</Text> : null}
        <Button onClick={handleLogout}>退出登录</Button>
      </Space>
    </Header>
  );
}

export default Navbar;