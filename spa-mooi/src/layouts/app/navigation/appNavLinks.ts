import { DatabaseBackup, FolderGit2, ListTodo, MessagesSquare, Rocket, ShieldCheck, UserRound } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import type { AppNavLink } from '@/layouts/app/types/AppNavLink';

/** Every top-level destination, in menu order. Four are phone tabs; the rest sit in the More sheet. */
export const appNavLinks: AppNavLink[] = [
  { id: 'projects', label: 'Projects', to: ROUTES.projects, icon: FolderGit2, tab: true },
  { id: 'sessions', label: 'Sessions', to: ROUTES.sessions, icon: MessagesSquare, tab: true },
  { id: 'todos', label: 'To-dos', to: ROUTES.todos, icon: ListTodo, tab: true },
  { id: 'deployments', label: 'Deployments', to: ROUTES.deployments, icon: Rocket, tab: true },
  { id: 'backups', label: 'Backups', to: ROUTES.backups, icon: DatabaseBackup },
  { id: 'account', label: 'Account', to: ROUTES.account, icon: UserRound },
  { id: 'admin', label: 'Admin', to: ROUTES.admin, icon: ShieldCheck, adminOnly: true },
];
