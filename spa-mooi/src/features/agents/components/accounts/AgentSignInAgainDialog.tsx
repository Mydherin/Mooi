import { ClaudePairing } from '@/features/agents/components/pairing/ClaudePairing';
import { CodexPairing } from '@/features/agents/components/pairing/CodexPairing';
import { accountName } from '@/features/agents/lib/accountName';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';

interface AgentSignInAgainDialogProps {
  /** The account to repair; null keeps the dialog closed. */
  connection: AgentConnection | null;
  onClose: () => void;
  onConnected: () => void;
}

/** Repairs an account in place through its provider's sign-in: title and default choice are kept. */
export const AgentSignInAgainDialog = ({ connection, onClose, onConnected }: AgentSignInAgainDialogProps) => (
  <Dialog open={connection !== null} onClose={onClose}
    title={connection ? `Sign in again to ${accountName(connection)}` : 'Sign in again'}
    description="The account is repaired in place: its title and default selection are kept.">
    {connection ? (
      connection.mode === 'device_oauth'
        ? <CodexPairing name={accountName(connection)} connectionId={connection.id} onConnected={onConnected} />
        : <ClaudePairing provider={connection.provider} name={connection.name ?? ''} connectionId={connection.id} onConnected={onConnected} />
    ) : null}
  </Dialog>
);
