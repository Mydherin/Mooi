import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { AppLayout } from '@/layouts/app/AppLayout';
import { MarketingLayout } from '@/layouts/marketing/MarketingLayout';
import { GuestRoute } from '@/shared/router/GuestRoute';
import { ProtectedRoute } from '@/shared/router/ProtectedRoute';
import { RoleRoute } from '@/shared/router/RoleRoute';
import { AccountPage } from '@/pages/AccountPage';
import { AdminPage } from '@/pages/AdminPage';
import { GithubCallbackPage } from '@/pages/GithubCallbackPage';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProjectPage } from '@/pages/ProjectPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { SessionPage } from '@/pages/SessionPage';

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [
      { path: ROUTES.home, element: <LandingPage /> },
      { path: ROUTES.notFound, element: <NotFoundPage /> },
    ],
  },
  {
    element: <GuestRoute />,
    children: [{ path: ROUTES.login, element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.projects, element: <ProjectsPage /> },
          { path: ROUTES.project, element: <ProjectPage /> },
          { path: ROUTES.session, element: <SessionPage /> },
          { path: ROUTES.account, element: <AccountPage /> },
          { path: ROUTES.githubCallback, element: <GithubCallbackPage /> },
          {
            element: <RoleRoute role="admin" />,
            children: [{ path: ROUTES.admin, element: <AdminPage /> }],
          },
        ],
      },
    ],
  },
]);
