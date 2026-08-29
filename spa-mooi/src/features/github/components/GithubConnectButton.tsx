import { LoaderCircle } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { GithubMark } from '@/shared/components/icons/GithubMark';

interface GithubConnectButtonProps {
  onConnect: () => void;
  busy?: boolean;
  label?: string;
}

/**
 * The single control that starts the OAuth2 flow. It carries the real GitHub mark because the
 * player is about to hand over access to that account and must recognise which one.
 */
export const GithubConnectButton = ({
  onConnect,
  busy = false,
  label = 'Continue with GitHub',
}: GithubConnectButtonProps) => (
  <Button variant="primary" onClick={onConnect} disabled={busy}>
    {busy ? (
      <LoaderCircle className="size-4 animate-spin" />
    ) : (
      <GithubMark className="size-4" />
    )}
    {busy ? 'Opening GitHub…' : label}
  </Button>
);
