import { LogIn } from 'lucide-react';
import { useGoogleIdentityServices } from '@/features/auth/hooks/useGoogleIdentityServices';
import { buttonStyles } from '@/shared/styles/buttonStyles';

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
  label?: string;
  busy?: boolean;
}

export const GoogleSignInButton = ({
  onCredential,
  label = 'Continue with Google',
  busy = false,
}: GoogleSignInButtonProps) => {
  const { containerRef, isReady } = useGoogleIdentityServices(onCredential);

  return (
    <div className="relative inline-flex w-full sm:w-auto">
      <span
        aria-hidden
        className={buttonStyles('primary', 'w-full justify-center sm:w-auto')}
        data-loading={busy || !isReady}
      >
        <LogIn className="size-4" />
        {busy ? 'Signing in…' : label}
      </span>

      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-0"
        style={{ colorScheme: 'light' }}
      />
    </div>
  );
};
