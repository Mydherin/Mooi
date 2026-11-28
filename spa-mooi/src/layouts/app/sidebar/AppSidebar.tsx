import { Link } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { AppAccountMenu } from '@/layouts/app/account/AppAccountMenu';
import { useNavLinks } from '@/layouts/app/navigation/useNavLinks';
import { AppSidebarItem } from '@/layouts/app/sidebar/AppSidebarItem';
import { AppSidebarProjects } from '@/layouts/app/sidebar/AppSidebarProjects';
import { IconButton } from '@/shared/components/actions/IconButton';
import { Logo } from '@/shared/components/brand/Logo';
import { Eyebrow } from '@/shared/components/data-display/Eyebrow';
import { cn } from '@/shared/utils/cn';
import { useSidebarStore } from '@/stores/sidebarStore';

interface AppSidebarProps {
  className?: string;
}

/** The desktop rail: brand, destinations, recent projects and the account. Collapses to icons (remembered per device). */
export const AppSidebar = ({ className }: AppSidebarProps) => {
  const links = useNavLinks();
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggle = useSidebarStore((state) => state.toggleCollapsed);

  return (
    <aside aria-label="Sidebar" className={cn('flex flex-col transition-[width] duration-300 ease-sheet', collapsed ? 'w-[72px]' : 'w-[252px]', className)}>
      <div className={cn('flex h-16 shrink-0 items-center gap-2', collapsed ? 'flex-col justify-center pt-3' : 'justify-between pr-2 pl-5')}>
        <Link to={ROUTES.projects} aria-label="Projects"
          className="rounded-control transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
          <Logo compact={collapsed} />
        </Link>
        <IconButton icon={collapsed ? PanelLeftOpen : PanelLeftClose} label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} size="sm" onClick={toggle}
          aria-expanded={!collapsed} />
      </div>

      <nav aria-label="Main" className={cn('flex flex-col gap-0.5 px-3', collapsed ? 'pt-6' : 'pt-2')}>
        {collapsed ? null : <Eyebrow className="px-2.5 pb-2">Workspace</Eyebrow>}
        {links.map((link) => <AppSidebarItem key={link.id} link={link} collapsed={collapsed} />)}
      </nav>

      {collapsed ? <div className="min-h-0 flex-1" /> : <AppSidebarProjects />}

      <div className="shrink-0 p-3">
        <div className="rounded-xl border border-line bg-surface/70 p-1 shadow-card">
          <AppAccountMenu collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
};
