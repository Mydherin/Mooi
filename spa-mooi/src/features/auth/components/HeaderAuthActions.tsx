import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Avatar } from '@/shared/components/Avatar';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { useAuthStore } from '@/stores/authStore';

export const HeaderAuthActions = () => {
  const player = useAuthStore((state) => state.player);
  const session = useAuthStore((state) => state.session);

  if (!player || !session) {
    return (
      <div className="flex items-center gap-1.5">
        <Link to={ROUTES.login} className={buttonStyles('ghost', 'sm')}>
          Sign in
        </Link>
        <Link
          to={ROUTES.login}
          className={buttonStyles('brand', 'sm', 'hidden sm:inline-flex')}
        >
          Get started
        </Link>
      </div>
    );
  }

  return (
    <Link
      to={ROUTES.projects}
      className="flex h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <Avatar src={player.avatarUrl} name={player.username} size="sm" />
      <span className="hidden sm:inline">Dashboard</span>
    </Link>
  );
};
