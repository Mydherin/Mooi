import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { loginWithGoogle } from '@/features/auth/api/authApi';
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton';
import { toAuthSession } from '@/features/auth/lib/toAuthSession';
import { Container } from '@/shared/components/Container';
import { useAuthStore } from '@/stores/authStore';

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
          navigate(ROUTES.account, { replace: true });
        })
        .catch(() => {
          setBusy(false);
          setError('Sign in failed. Please try again.');
        });
    },
    [navigate, setSession],
  );

  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
        <ShieldCheck className="size-6" />
      </span>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Sign in</h1>
      <p className="mt-3 max-w-md text-base text-slate-600 dark:text-slate-400">
        Use your Google account to continue. Your first sign-in creates your player profile.
      </p>

      <div className="mt-10">
        <GoogleSignInButton onCredential={handleCredential} busy={busy} />
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}
    </Container>
  );
};
