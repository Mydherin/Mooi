import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { GuestRoute } from '@/shared/router/GuestRoute';
import { ProtectedRoute } from '@/shared/router/ProtectedRoute';
import { RoleRoute } from '@/shared/router/RoleRoute';
import { RootLayout } from '@/layouts/RootLayout';
import { AccountPage } from '@/pages/AccountPage';
import { AdminPage } from '@/pages/AdminPage';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: ROUTES.home, element: <LandingPage /> },
      {
        element: <GuestRoute />,
        children: [{ path: ROUTES.login, element: <LoginPage /> }],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: ROUTES.account, element: <AccountPage /> },
          {
            element: <RoleRoute role="admin" />,
            children: [{ path: ROUTES.admin, element: <AdminPage /> }],
          },
        ],
      },
      { path: ROUTES.notFound, element: <NotFoundPage /> },
    ],
  },
]);
