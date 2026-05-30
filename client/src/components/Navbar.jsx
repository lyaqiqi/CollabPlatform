import { Layout, Button, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const { Header } = Layout;
const { Text } = Typography;

/**
 * 顶部导航栏。仅在已登录时显示（由页面组件决定是否渲染此组件）。
 */
function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
      <Text strong style={{ color: '#fff', fontSize: 18 }}>
        CollabPlatform
      </Text>
      <Space>
        {user && <Text style={{ color: '#fff' }}>{user.username}</Text>}
        <Button type="link" style={{ color: '#fff' }} onClick={handleLogout}>
          退出登录
        </Button>
      </Space>
    </Header>
  );
}

export default Navbar;
