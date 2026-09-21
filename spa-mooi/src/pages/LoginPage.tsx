import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, CircleCheck } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { env } from '@/config/env';
import { loginWithGoogle } from '@/features/auth/api/authApi';
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton';
import { toAuthSession } from '@/features/auth/lib/toAuthSession';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { Logo } from '@/shared/components/Logo';
import { LogoMark } from '@/shared/components/LogoMark';
import { useAuthStore } from '@/stores/authStore';

const highlights = [
  'Import the repositories you already own',
  'Agent sessions with full project context',
  'Review every change, right beside the conversation',
];

/**
 * The first screen of the application, and the only one a signed-out player can reach.
 *
 * The workspace runs on the player's own repositories, so the copy stays on what a Google account
 * gets them and what happens next; there is nothing else to decide on this screen.
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
    <div className="min-h-dvh bg-canvas text-ink lg:grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-contrast p-12 text-contrast-ink lg:flex lg:flex-col xl:p-16">
        <div aria-hidden className="pointer-events-none absolute -right-40 bottom-[-15rem] size-[650px] rounded-full border-[80px] border-contrast-ink/10" />

        <Logo />

        <div className="my-auto">
          <h2 className="max-w-lg text-5xl font-extrabold leading-[1.08] tracking-[-0.05em] text-balance xl:text-6xl">
            Less friction.
            More creating.
          </h2>

          <p className="mt-6 max-w-sm text-base leading-relaxed text-contrast-ink/75">From the first idea to the next commit. A calmer place to build software with your agents.</p>
          <ul className="mt-10 flex flex-col gap-4">
            {highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3 text-sm text-contrast-ink/80">
                <CircleCheck className="mt-0.5 size-4.5 shrink-0 text-contrast-ink/70" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-contrast-ink/65">
          © {new Date().getFullYear()} {env.appName}
        </p>
      </aside>

      <main className="relative flex min-h-dvh flex-col justify-center px-4 py-12 sm:px-8 lg:min-h-0">
        <div className="absolute top-5 right-5"><ThemeToggle /></div>
        <div className="mx-auto w-full max-w-sm">
          <LogoMark className="size-10 lg:hidden" />

          <h1 className="mt-8 text-[40px] font-extrabold tracking-[-0.045em] text-ink lg:mt-0">Welcome to Mooi<span className="text-brand">.</span></h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Continue with Google to open your workspace. Your first sign-in creates your account.
          </p>

          <div className="mt-8 rounded-[14px] border border-line bg-surface p-5">
            <p className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">Your next idea starts here <ArrowUpRight className="size-4 text-brand" /></p>
            <GoogleSignInButton onCredential={handleCredential} busy={busy} />
          </div>

          {error ? (
            <p className="mt-4 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <p className="mt-8 text-xs leading-relaxed text-ink-subtle">
            Mooi works on your own repositories. Nothing is imported until you connect GitHub, and
            you can unlink it at any time from the account screen.
          </p>
        </div>
      </main>
    </div>
  );
};
