import { useState } from 'react';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { signOut, signOutEverywhere } from '@/features/auth/lib/signOut';
import { cn } from '@/shared/utils/cn';

export const SignOutControls = () => {
  const navigate = useNavigate();
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    await action();
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(signOut)}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/70 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/25 dark:hover:bg-white/10',
        )}
      >
        <LogOut className="size-4" />
        Log out
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (confirmAll) {
            void run(signOutEverywhere);
          } else {
            setConfirmAll(true);
          }
        }}
        onBlur={() => setConfirmAll(false)}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition disabled:opacity-60',
          confirmAll
            ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
            : 'border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/25 dark:hover:bg-white/10',
        )}
      >
        <MonitorSmartphone className="size-4" />
        {confirmAll ? 'Confirm — all devices' : 'All devices'}
      </button>
    </div>
  );
};
