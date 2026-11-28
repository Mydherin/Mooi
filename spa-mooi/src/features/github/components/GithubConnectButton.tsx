import { Button } from '@/shared/components/actions/Button';
import { GithubMark } from '@/shared/components/brand/GithubMark';

interface GithubConnectButtonProps {
  onConnect: () => void;
  busy?: boolean;
  label?: string;
  fullWidth?: boolean;
}

/**
 * The single control that starts the OAuth2 flow. It carries the real GitHub mark because the
 * player is about to hand over access to that account and must recognise which one.
 */
export const GithubConnectButton = ({ onConnect, busy = false, label = 'Continue with GitHub', fullWidth = false }: GithubConnectButtonProps) => (
  <Button variant="primary" size="lg" onClick={onConnect} loading={busy} fullWidth={fullWidth}>
    {busy ? null : <GithubMark className="size-4 shrink-0" />}
    {busy ? 'Opening GitHub…' : label}
  </Button>
);
