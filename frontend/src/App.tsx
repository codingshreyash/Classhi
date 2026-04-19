import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { HomePage } from './pages/HomePage';
import { MarketListPage } from './pages/MarketListPage';
import { MarketDetailPage } from './pages/MarketDetailPage';
import { CreateMarketPage } from './pages/CreateMarketPage';
import { PortfolioPage } from './pages/PortfolioPage';

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
          { path: '/', element: <Navigate to="/markets" replace /> },
          { path: '/home', element: <Navigate to="/markets" replace /> },
          { path: '/markets', element: <MarketListPage /> },
          { path: '/markets/:marketId', element: <MarketDetailPage /> },
          { path: '/admin/create-market', element: <CreateMarketPage /> },
          { path: '/portfolio', element: <PortfolioPage /> },
          // Keep HomePage for any direct references, it self-redirects
          { path: '/homepage', element: <HomePage /> },
        ],
      },
    ],
  },
]);
