import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { installNavigationGuards } from '@/app/navigation/installNavigationGuards';
import { ROUTES } from '@/app/routes';
import { AppLayout } from '@/layouts/app/AppLayout';
import { GuestRoute } from '@/shared/router/GuestRoute';
import { ProtectedRoute } from '@/shared/router/ProtectedRoute';
import { RoleRoute } from '@/shared/router/RoleRoute';
import type { RouteHandle } from '@/shared/types/RouteHandle';

const immersive: RouteHandle = { immersive: true };

/** Each screen is its own chunk, loaded when first visited: the shell starts with only what it shows. */
const screen = (load: () => Promise<{ Component: () => ReactNode }>) => ({ lazy: load });

/**
 * Every screen lives behind a session. The application is a workspace, not a site: there is nothing
 * to show a visitor who is not signed in, so the guest tree holds the login screen alone and even
 * the not-found route sits inside the protected tree — an unknown path reached signed out lands on
 * the login screen rather than on a dead end.
 */
export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [{ path: ROUTES.login, ...screen(async () => ({ Component: (await import('@/pages/LoginPage')).LoginPage })) }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.root, element: <Navigate to={ROUTES.projects} replace /> },
          { path: ROUTES.projects, ...screen(async () => ({ Component: (await import('@/pages/ProjectsPage')).ProjectsPage })) },
          { path: ROUTES.project, ...screen(async () => ({ Component: (await import('@/pages/ProjectPage')).ProjectPage })) },
          { path: ROUTES.session, handle: immersive, ...screen(async () => ({ Component: (await import('@/pages/SessionPage')).SessionPage })) },
          { path: ROUTES.sessions, ...screen(async () => ({ Component: (await import('@/pages/SessionsPage')).SessionsPage })) },
          { path: ROUTES.todos, ...screen(async () => ({ Component: (await import('@/pages/TodosPage')).TodosPage })) },
          { path: ROUTES.deployments, ...screen(async () => ({ Component: (await import('@/pages/DeploymentsPage')).DeploymentsPage })) },
          { path: ROUTES.deployment, handle: immersive,
            ...screen(async () => ({ Component: (await import('@/pages/ProjectDeploymentPage')).ProjectDeploymentPage })) },
          { path: ROUTES.backups, ...screen(async () => ({ Component: (await import('@/pages/BackupsPage')).BackupsPage })) },
          { path: ROUTES.backup, handle: immersive,
            ...screen(async () => ({ Component: (await import('@/pages/ProjectBackupPage')).ProjectBackupPage })) },
          { path: ROUTES.account, ...screen(async () => ({ Component: (await import('@/pages/AccountPage')).AccountPage })) },
          { path: ROUTES.githubCallback, ...screen(async () => ({ Component: (await import('@/pages/GithubCallbackPage')).GithubCallbackPage })) },
          {
            element: <RoleRoute role="admin" />,
            children: [{ path: ROUTES.admin, ...screen(async () => ({ Component: (await import('@/pages/AdminPage')).AdminPage })) }],
          },
          { path: ROUTES.notFound, ...screen(async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage })) },
        ],
      },
    ],
  },
], { basename: import.meta.env.BASE_URL });

installNavigationGuards(router);
