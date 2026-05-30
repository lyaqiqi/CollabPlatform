import { createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import HomePage from '../pages/HomePage';
import BoardPage from '../pages/BoardPage';
import DocPage from '../pages/DocPage';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <HomePage />
      </ProtectedRoute>
    ),
  },
  {
    // /board/:id — 由 B 实现白板编辑功能
    path: '/board/:id',
    element: (
      <ProtectedRoute>
        <BoardPage />
      </ProtectedRoute>
    ),
  },
  {
    // /doc/:id — 由 C 实现文档编辑功能
    path: '/doc/:id',
    element: (
      <ProtectedRoute>
        <DocPage />
      </ProtectedRoute>
    ),
  },
]);

export default router;
