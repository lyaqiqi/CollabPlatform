import { Typography } from 'antd';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

// TODO: 由 D 实现登录表单（调用 login API，成功后 setAuth + 跳首页）
function LoginPage() {
  const accessToken = useAuthStore((s) => s.accessToken);

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Typography.Title level={2}>登录页 — 由 D 实现</Typography.Title>
    </div>
  );
}

export default LoginPage;
