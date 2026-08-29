import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { AppLayout } from '@/layouts/app/AppLayout';
import { GuestRoute } from '@/shared/router/GuestRoute';
import { ProtectedRoute } from '@/shared/router/ProtectedRoute';
import { RoleRoute } from '@/shared/router/RoleRoute';
import { AccountPage } from '@/pages/AccountPage';
import { AdminPage } from '@/pages/AdminPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GithubCallbackPage } from '@/pages/GithubCallbackPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProjectPage } from '@/pages/ProjectPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { SessionPage } from '@/pages/SessionPage';

/**
 * Every screen lives behind a session. The application is a workspace, not a site: there is nothing
 * to show a visitor who is not signed in, so the guest tree holds the login screen alone and even
 * the not-found route sits inside the protected tree — an unknown path reached signed out lands on
 * the login screen rather than on a dead end.
 */
export const router = createBrowserRouter([
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
          { path: ROUTES.home, element: <DashboardPage /> },
          { path: ROUTES.projects, element: <ProjectsPage /> },
          { path: ROUTES.project, element: <ProjectPage /> },
          { path: ROUTES.session, element: <SessionPage /> },
          { path: ROUTES.account, element: <AccountPage /> },
          { path: ROUTES.githubCallback, element: <GithubCallbackPage /> },
          {
            element: <RoleRoute role="admin" />,
            children: [{ path: ROUTES.admin, element: <AdminPage /> }],
          },
          { path: ROUTES.notFound, element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
