/** `home` is the signed-in dashboard: the application has no public page to send a visitor to. */
export const ROUTES = {
  home: '/',
  login: '/login',
  projects: '/projects',
  project: '/projects/:projectId',
  session: '/projects/:projectId/sessions/:sessionId',
  account: '/account',
  githubCallback: '/account/github/callback',
  admin: '/admin',
  notFound: '*',
} as const;
