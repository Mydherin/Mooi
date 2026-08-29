import { FolderGit2, LayoutDashboard, ShieldCheck, UserRound } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import type { AppNavLink } from '@/shared/types/AppNavLink';

export const appNavLinks: AppNavLink[] = [
  { id: 'dashboard', label: 'Dashboard', to: ROUTES.home, icon: LayoutDashboard, end: true },
  { id: 'projects', label: 'Projects', to: ROUTES.projects, icon: FolderGit2 },
  { id: 'account', label: 'Account', to: ROUTES.account, icon: UserRound },
  { id: 'admin', label: 'Admin', to: ROUTES.admin, icon: ShieldCheck, adminOnly: true },
];
