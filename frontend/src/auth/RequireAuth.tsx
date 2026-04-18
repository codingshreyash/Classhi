import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAuth() {
  const { userId, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-classhi-bg">
        <p className="text-base text-gray-500">Loading...</p>
      </div>
    );
  }

  return userId ? <Outlet /> : <Navigate to="/login" replace />;
}
