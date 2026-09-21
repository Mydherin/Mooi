import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CircleAlert, CircleCheck, LoaderCircle, ShieldCheck } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import { Card } from '@/shared/components/Card';
import { buttonStyles } from '@/shared/styles/buttonStyles';

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
    <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
      <h1 className="text-[32px] font-extrabold tracking-[-0.045em] text-ink sm:text-[38px]">Admin</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Manage and check access to your workspace.
      </p>

      <Card className="mt-6 p-5 sm:p-6">
        <span className="flex size-11 items-center justify-center rounded-[10px] bg-surface-2 text-ink-muted">
          <ShieldCheck className="size-5" />
        </span>

        <p className="mt-5 font-mono text-xs text-ink-subtle">Workspace access</p>

        <p
          data-state={state}
          className="mt-3 inline-flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm font-bold data-[state=error]:border-danger/30 data-[state=error]:bg-danger-soft data-[state=error]:text-danger data-[state=loading]:border-line data-[state=loading]:bg-surface-2 data-[state=loading]:text-ink-subtle data-[state=ok]:border-success/30 data-[state=ok]:bg-success-soft data-[state=ok]:text-success"
        >
          {state === 'loading' && (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Checking…
            </>
          )}
          {state === 'ok' && (
            <>
              <CircleCheck className="size-4" />
              Administrator access verified
            </>
          )}
          {state === 'error' && (
            <>
              <CircleAlert className="size-4" />
              Access could not be verified
            </>
          )}
        </p>
      </Card>

      <Link to={ROUTES.projects} className={buttonStyles('ghost', 'sm', 'mt-6 -ml-3.5')}>
        <ArrowLeft className="size-4" />
        Back to projects
      </Link>
    </div>
  );
};
