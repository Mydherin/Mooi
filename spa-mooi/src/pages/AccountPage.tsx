import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { SignOutControls } from '@/features/auth/components/SignOutControls';
import { Container } from '@/shared/components/Container';
import { useAuthStore } from '@/stores/authStore';

export const AccountPage = () => {
  const player = useAuthStore((state) => state.player);
  const isAdmin = useAuthStore((state) => state.player?.role === 'admin');

  if (!player) {
    return null;
  }

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-4">
            {player.avatarUrl ? (
              <img
                src={player.avatarUrl}
                alt=""
                className="size-16 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-semibold text-white">
                {player.username.charAt(0).toUpperCase()}
              </span>
            )}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{player.username}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">{player.email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 capitalize dark:bg-indigo-500/10 dark:text-indigo-300">
                {player.role}
              </span>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200/70 pt-6 dark:border-white/10">
            <SignOutControls />
          </div>
        </div>

        {isAdmin && (
          <Link
            to={ROUTES.admin}
            className="mt-6 flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/70 px-5 py-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20"
          >
            <ShieldCheck className="size-4 text-indigo-500" />
            Open the admin area
          </Link>
        )}
      </div>
    </Container>
  );
};
