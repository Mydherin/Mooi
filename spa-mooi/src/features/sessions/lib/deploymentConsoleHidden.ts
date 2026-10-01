import type { Session } from '@/features/sessions/types/Session';

/** While the agent prepares the deployment the console stays hidden; its test start reveals it. */
export const deploymentConsoleHidden = (session: Session): boolean =>
  session.deploymentSetup === 'preparing'
  && session.deployment.state !== 'starting'
  && session.deployment.state !== 'running';
