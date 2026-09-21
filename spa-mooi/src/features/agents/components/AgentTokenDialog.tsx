import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface AgentTokenDialogProps {
  open: boolean;
  providerLabel: string;
  busy: boolean;
  actionError: string | null;
  onClose: () => void;
  onSubmit: (token: string) => Promise<boolean>;
}

/**
 * The token door of the integration: a single pasted credential, never OAuth.
 *
 * No mode selector — an Anthropic API key is not a supported credential here, only a Claude Code
 * setup token is, so there is nothing for the player to choose between.
 */
export const AgentTokenDialog = ({
  open,
  providerLabel,
  busy,
  actionError,
  onClose,
  onSubmit,
}: AgentTokenDialogProps) => {
  const [token, setToken] = useState('');

  useEffect(() => {
    if (open) {
      setToken('');
    }
  }, [open]);

  const handleSubmit = () => {
    if (token.trim().length === 0) {
      return;
    }

    void onSubmit(token.trim()).then((succeeded) => {
      if (succeeded) {
        onClose();
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Connect ${providerLabel} with a token`}
      description="Paste a token minted by running `claude setup-token` on your machine."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={busy || token.trim().length === 0}>
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink-muted">Setup token</span>
        <span className="flex h-12 w-full items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-3 transition focus-within:border-brand/50">
          <KeyRound className="size-4 shrink-0 text-ink-subtle" />
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="sk-ant-oat01-…"
            autoComplete="off"
            aria-label="Setup token"
            className="h-full w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </span>
      </label>

      {actionError ? (
        <p className="mt-4 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {actionError}
        </p>
      ) : null}
    </Modal>
  );
};
