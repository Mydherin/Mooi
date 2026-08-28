export const ROUTES = {
  home: '/',
  login: '/login',
  projects: '/projects',
  project: '/projects/:projectId',
  session: '/projects/:projectId/sessions/:sessionId',
  account: '/account',
  admin: '/admin',
  notFound: '*',
} as const;
