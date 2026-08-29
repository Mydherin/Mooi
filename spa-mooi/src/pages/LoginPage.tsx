import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { env } from '@/config/env';
import { loginWithGoogle } from '@/features/auth/api/authApi';
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton';
import { toAuthSession } from '@/features/auth/lib/toAuthSession';
import { Logo } from '@/shared/components/Logo';
import { LogoMark } from '@/shared/components/LogoMark';
import { GithubMark } from '@/shared/components/icons/GithubMark';
import { useAuthStore } from '@/stores/authStore';

const highlights = [
  'Import the repositories you already own',
  'Agent sessions with full project context',
  'Preview and ship without leaving the conversation',
];

/**
 * The first screen of the application, and the only one a signed-out player can reach.
 *
 * Signing in is deliberately presented as step one of two: the workspace runs on the player's own
 * repositories, so a Google account alone opens an empty shell. Saying that here, before the click,
 * is what stops the dashboard from feeling broken a moment later.
 */
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
          navigate(ROUTES.home, { replace: true });
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

        <Logo />

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
          <LogoMark className="size-10 lg:hidden" />

          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-ink lg:mt-0">Sign in</h1>
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

          <div className="mt-8 rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-ink-subtle uppercase">
              Two steps to start
            </p>
            <ol className="mt-3 flex flex-col gap-2.5 text-sm text-ink-muted">
              <li className="flex items-center gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-ink">
                  1
                </span>
                Sign in with Google
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink">
                  <GithubMark className="size-3" />
                </span>
                Connect your GitHub account
              </li>
            </ol>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-ink-subtle">
            Mooi works on your own repositories. Nothing is imported until you connect GitHub, and
            you can unlink it at any time from the account screen.
          </p>
        </div>
      </main>
    </div>
  );
};
