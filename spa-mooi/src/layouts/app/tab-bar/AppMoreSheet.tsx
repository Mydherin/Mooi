import { LogOut } from 'lucide-react';
import { projectPath } from '@/app/paths';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { AccountSummary } from '@/layouts/app/account/AccountSummary';
import type { AppNavLink } from '@/layouts/app/types/AppNavLink';
import { Initials } from '@/shared/components/data-display/Initials';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { ListRow } from '@/shared/components/data-display/ListRow';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';
import { Sheet } from '@/shared/components/overlays/sheet/Sheet';
import type { Theme } from '@/shared/types/Theme';
import { useAuthStore } from '@/stores/authStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useThemeStore } from '@/stores/themeStore';

interface AppMoreSheetProps {
  open: boolean;
  onClose: () => void;
  /** The destinations that are not tabs. */
  links: AppNavLink[];
}

const RECENT_PROJECTS = 4;
const THEMES = [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }];

/** Everything the tab bar has no room for: the account, the other destinations, recent projects, the theme and signing out. */
export const AppMoreSheet = ({ open, onClose, links }: AppMoreSheetProps) => {
  const player = useAuthStore((state) => state.player);
  const projects = useProjectsStore((state) => state.projects);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const { busy, signOutHere } = useSignOut();

  return (
    <Sheet open={open} onClose={onClose} title="More" detents={['medium', 'large']}>
      <div className="flex flex-col gap-6">
        {player ? <div className="-mx-1 overflow-hidden rounded-card border border-line bg-surface-2/50"><AccountSummary player={player} /></div> : null}

        <ListGroup>
          {links.map((link) => {
            const Icon = link.icon;
            return <ListRow key={link.id} to={link.to} title={link.label}
              leading={<Icon aria-hidden className="size-5 text-ink-subtle" />}
              trailing={link.attention ? <span className="rounded-full bg-warning-dot px-1.5 text-[11px] font-bold text-white">{link.attention}</span> : undefined} />;
          })}
        </ListGroup>

        {projects.length > 0 ? (
          <ListGroup title="Recent projects">
            {projects.slice(0, RECENT_PROJECTS).map((project) => (
              <ListRow key={project.id} to={projectPath(project.id)} title={project.name} subtitle={project.fullName}
                leading={<Initials value={project.name} size="md" />} />
            ))}
          </ListGroup>
        ) : null}

        <section aria-labelledby="more-theme" className="flex items-center justify-between gap-3 px-1">
          <h3 id="more-theme" className="text-callout font-medium text-ink">Appearance</h3>
          <SegmentedControl labelledBy="more-theme" items={THEMES} value={theme} onChange={(id) => setTheme(id as Theme)} />
        </section>

        <ListGroup>
          <ListRow title={busy ? 'Signing out…' : 'Log out'} destructive disabled={busy} onClick={signOutHere} chevron={false}
            leading={<LogOut aria-hidden className="size-5 text-danger" />} />
        </ListGroup>
      </div>
    </Sheet>
  );
};
