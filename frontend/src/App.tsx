import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { HomePage } from './pages/HomePage';

function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignUpPage /> },
      { path: '/confirm', element: <ConfirmPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/home', element: <HomePage /> },
          { path: '/', element: <HomePage /> },
        ],
      },
    ],
  },
]);
