import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { useAuthStore } from '@/stores/authStore';

export const HeaderAuthActions = () => {
  const player = useAuthStore((state) => state.player);
  const session = useAuthStore((state) => state.session);

  if (!player || !session) {
    return (
      <Link
        to={ROUTES.login}
        className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      >
        Sign in
      </Link>
    );
  }

  return (
    <Link
      to={ROUTES.account}
      className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
    >
      {player.avatarUrl ? (
        <img src={player.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
      ) : (
        <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <UserRound className="size-4" />
        </span>
      )}
      <span className="hidden sm:inline">{player.username}</span>
    </Link>
  );
};
