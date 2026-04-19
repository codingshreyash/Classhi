import { Amplify } from 'aws-amplify';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './App';
import './index.css';

// Validate env vars at startup (fail fast, not silent misconfigure)
if (!import.meta.env.VITE_USER_POOL_ID) {
  throw new Error('VITE_USER_POOL_ID not set -- check .env.local');
}
if (!import.meta.env.VITE_USER_POOL_CLIENT_ID) {
  throw new Error('VITE_USER_POOL_CLIENT_ID not set -- check .env.local');
}
if (!import.meta.env.VITE_WS_API_URL) {
  throw new Error('VITE_WS_API_URL not set -- check .env.local');
}

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
