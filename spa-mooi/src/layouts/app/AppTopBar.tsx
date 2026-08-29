import { Link } from 'react-router-dom';
import { FolderGit2, Menu } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { env } from '@/config/env';
import { Avatar } from '@/shared/components/Avatar';
import { IconButton } from '@/shared/components/IconButton';
import { Logo } from '@/shared/components/Logo';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarStore } from '@/stores/sidebarStore';

export const AppTopBar = () => {
  const player = useAuthStore((state) => state.player);
  const open = useSidebarStore((state) => state.open);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-xl lg:px-6">
      <IconButton icon={Menu} label="Open navigation" onClick={open} className="lg:hidden" />

      <Link
        to={ROUTES.projects}
        className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand lg:hidden"
      >
        <Logo compact />
      </Link>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <a
          href={env.githubUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open repository"
          className="hidden size-10 items-center justify-center rounded-xl text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:flex"
        >
          <FolderGit2 className="size-4.5" />
        </a>
        {player ? (
          <Link
            to={ROUTES.account}
            aria-label="Open account"
            className="flex size-10 items-center justify-center rounded-xl transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
          >
            <Avatar src={player.avatarUrl} name={player.username} size="sm" />
          </Link>
        ) : null}
      </div>
    </header>
  );
};
