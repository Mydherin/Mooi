import { LogIn } from 'lucide-react';
import { Button } from '@/shared/components/actions/Button';
import { Alert } from '@/shared/components/feedback/Alert';

interface AgentAccountRepairNoticeProps {
  providerLabel: string;
  stale: boolean;
  legacy: boolean;
  busy: boolean;
  /** Absent when the provider's sign-in is not offered, so the account cannot be repaired here. */
  onSignInAgain?: () => void;
}

/** Why an account needs attention, and the in-place repair: its title and default choice are kept. */
export const AgentAccountRepairNotice = ({ providerLabel, stale, legacy, busy, onSignInAgain }: AgentAccountRepairNoticeProps) => (
  <div className="px-4 pb-3 sm:pl-17">
    <Alert tone="warning" title={stale ? `${providerLabel} signed this account out` : 'Linked with a deprecated token'}>
      <p className="text-ink-muted">
        {stale
          ? 'Sign in again to repair it, there is no need to remove it.'
          : `Setup tokens expire and cannot be renewed. Sign in with ${providerLabel} to keep this account renewed automatically.`}
      </p>
      {onSignInAgain ? (
        <Button variant="secondary" size="sm" icon={LogIn} onClick={onSignInAgain} disabled={busy} className="mt-2.5 w-full sm:w-auto">
          Sign in again
        </Button>
      ) : null}
    </Alert>
  </div>
);
