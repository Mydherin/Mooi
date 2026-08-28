import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import { Container } from '@/shared/components/Container';

type PingState = 'loading' | 'ok' | 'error';

export const AdminPage = () => {
  const [state, setState] = useState<PingState>('loading');

  useEffect(() => {
    let cancelled = false;

    authenticatedFetch('/admin/ping')
      .then((response) => {
        if (!cancelled) {
          setState(response.ok ? 'ok' : 'error');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-xl text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 mx-auto">
          <ShieldCheck className="size-6" />
        </span>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Admin area</h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
          The server verifies your role independently of this screen.
        </p>

        <p className="mt-8 rounded-xl border px-4 py-3 text-sm font-medium data-[state=ok]:border-emerald-300 data-[state=ok]:bg-emerald-50 data-[state=ok]:text-emerald-700 data-[state=error]:border-rose-300 data-[state=error]:bg-rose-50 data-[state=error]:text-rose-700 data-[state=loading]:border-slate-200 data-[state=loading]:text-slate-500 dark:data-[state=ok]:border-emerald-500/40 dark:data-[state=ok]:bg-emerald-500/10 dark:data-[state=ok]:text-emerald-300 dark:data-[state=error]:border-rose-500/40 dark:data-[state=error]:bg-rose-500/10 dark:data-[state=error]:text-rose-300"
          data-state={state}
        >
          {state === 'loading' && 'Checking /admin/ping…'}
          {state === 'ok' && 'GET /admin/ping → ok'}
          {state === 'error' && 'GET /admin/ping → denied'}
        </p>

        <Link
          to={ROUTES.account}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/25 dark:hover:bg-white/10"
        >
          <ArrowLeft className="size-4" />
          Back to account
        </Link>
      </div>
    </Container>
  );
};
