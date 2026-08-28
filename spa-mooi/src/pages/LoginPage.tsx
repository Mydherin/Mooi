import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleCheck } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { env } from '@/config/env';
import { loginWithGoogle } from '@/features/auth/api/authApi';
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton';
import { toAuthSession } from '@/features/auth/lib/toAuthSession';
import { Logo } from '@/shared/components/Logo';
import { LogoMark } from '@/shared/components/LogoMark';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { useAuthStore } from '@/stores/authStore';

const highlights = [
  'Every repository, session and deploy in one place',
  'Sessions that keep full project context',
  'Preview and ship without leaving the conversation',
];

export const LoginPage = () => {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredential = useCallback(
    (idToken: string) => {
      setBusy(true);
      setError(null);

      loginWithGoogle(idToken)
        .then((response) => {
          setSession(response.player, toAuthSession(response));
          navigate(ROUTES.projects, { replace: true });
        })
        .catch(() => {
          setBusy(false);
          setError('Sign in failed. Please try again.');
        });
    },
    [navigate, setSession],
  );

  return (
    <div className="min-h-dvh bg-canvas text-ink lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface p-12 lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-16 size-[420px] animate-float-slow rounded-full bg-brand/25 blur-[130px]" />
          <div className="absolute right-0 bottom-0 size-[360px] animate-float-fast rounded-full bg-info/20 blur-[130px]" />
        </div>

        <Link
          to={ROUTES.home}
          className="w-fit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo />
        </Link>

        <div className="my-auto">
          <h2 className="max-w-md text-4xl font-semibold tracking-tight text-balance text-ink">
            Your workspace for agent-built software.
          </h2>

          <ul className="mt-10 flex flex-col gap-4">
            {highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3 text-sm text-ink-muted">
                <CircleCheck className="mt-0.5 size-4.5 shrink-0 text-brand" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-ink-subtle">
          © {new Date().getFullYear()} {env.appName}
        </p>
      </aside>

      <main className="flex min-h-dvh flex-col justify-center px-4 py-12 sm:px-8 lg:min-h-0">
        <div className="mx-auto w-full max-w-sm">
          <Link to={ROUTES.home} className={buttonStyles('ghost', 'sm', '-ml-3.5')}>
            <ArrowLeft className="size-4" />
            Back to home
          </Link>

          <LogoMark className="mt-8 size-10 lg:hidden" />

          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Continue with Google to open your workspace. Your first sign-in creates your account.
          </p>

          <div className="mt-8">
            <GoogleSignInButton onCredential={handleCredential} busy={busy} />
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-danger/40 bg-danger-soft px-4 py-2.5 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <p className="mt-6 text-xs leading-relaxed text-ink-subtle">
            Repositories, sessions and deploys stay under your own account. You can disconnect them
            at any time from the account screen.
          </p>
        </div>
      </main>
    </div>
  );
};
