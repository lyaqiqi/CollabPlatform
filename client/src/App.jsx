import { RouterProvider } from 'react-router-dom';
import { useEffect } from 'react';
import router from './router/index';
import useAuthStore from './store/authStore';

function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return <RouterProvider router={router} />;
}

export default App;