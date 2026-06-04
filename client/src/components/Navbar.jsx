import { Layout, Button, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const { Header } = Layout;
const { Text, Title } = Typography;

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
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Title level={4} style={{ margin: 0, color: 'rgba(0,0,0,0.92)' }}>
          CollabPlatform
        </Title>
        <Text type="secondary">多人实时协作平台</Text>
      </div>
      <Space size={16} align="center">
        {user ? <Text>{user.username}</Text> : null}
        <Button onClick={handleLogout}>退出登录</Button>
      </Space>
    </Header>
  );
}

export default Navbar;
