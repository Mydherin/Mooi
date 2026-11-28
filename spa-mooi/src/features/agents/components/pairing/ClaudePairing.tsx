import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, KeyRound } from 'lucide-react';
import { completeAgentAuthorization, startAgentAuthorization } from '@/features/agents/api/agentsApi';
import { PairingPreparing } from '@/features/agents/components/pairing/PairingPreparing';
import { PairingStep } from '@/features/agents/components/pairing/PairingStep';
import type { AgentAuthorizationResponse } from '@/features/agents/types/AgentAuthorizationResponse';
import { Button } from '@/shared/components/actions/Button';
import { Alert } from '@/shared/components/feedback/Alert';
import { TextField } from '@/shared/components/forms/TextField';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { useAgentsStore } from '@/stores/agentsStore';

interface ClaudePairingProps {
  provider: string;
  name: string;
  /** Signs this existing account in again instead of adding one. */
  connectionId?: string;
  onConnected: () => void;
}

/**
 * The Claude Code sign-in: the player authorizes on Anthropic's own page, which then shows a code to
 * paste back here (Claude Code's client only redirects to that page). The code is redeemed by the API
 * with the state it signed, so this component never handles a token.
 */
export const ClaudePairing = ({ provider, name, connectionId, onConnected }: ClaudePairingProps) => {
  const [attempt, setAttempt] = useState<AgentAuthorizationResponse | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    startAgentAuthorization(provider)
      .then((value) => { if (!disposed) setAttempt(value); })
      .catch((cause: Error) => { if (!disposed) setError(cause.message); });
    return () => { disposed = true; };
  }, [provider]);

  const connect = (event: FormEvent) => {
    event.preventDefault();
    if (!attempt || !code.trim() || busy) return;
    setBusy(true);
    setError(null);
    completeAgentAuthorization(provider, code.trim(), attempt.state, name, connectionId)
      .then((connection) => {
        useAgentsStore.getState().upsertConnection(connection);
        onConnected();
      })
      .catch((cause: Error) => {
        setBusy(false);
        setError(cause.message);
      });
  };

  if (!attempt) {
    return error ? <Alert tone="danger">{error}</Alert> : <PairingPreparing />;
  }

  return (
    <form onSubmit={connect} className="flex animate-fade-up flex-col gap-5">
      <PairingStep index={1} title="Authorize Claude Code" description="Sign in with your Claude account on Anthropic's page.">
        <a href={attempt.authorizeUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles('brand', 'lg', 'w-full')}>
          Continue with Claude <ExternalLink aria-hidden className="size-4" />
        </a>
      </PairingStep>
      <PairingStep index={2} title="Paste the code" description="Copy the code Anthropic shows once you authorize.">
        <div className="flex flex-col gap-3">
          <TextField label="Authorization code" hideLabel value={code} onChange={setCode} disabled={busy} mono
            placeholder="Paste the code" autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="text" enterKeyHint="done"
            leading={<KeyRound aria-hidden className="size-4" />}
            hint="It works once and expires after a few minutes. If the app reloads meanwhile, reopen this step and paste it all the same." />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" variant="primary" size="lg" fullWidth loading={busy} disabled={!code.trim()}>
            {busy ? 'Connecting…' : 'Connect account'}
          </Button>
        </div>
      </PairingStep>
    </form>
  );
};
