import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * 路由守卫：未登录时重定向到 /login
 */
function ProtectedRoute({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default ProtectedRoute;
