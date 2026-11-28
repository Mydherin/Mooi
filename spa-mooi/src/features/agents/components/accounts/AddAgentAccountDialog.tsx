import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { ClaudePairing } from '@/features/agents/components/pairing/ClaudePairing';
import { CodexPairing } from '@/features/agents/components/pairing/CodexPairing';
import type { AgentProvider } from '@/features/agents/types/AgentProvider';
import { Button } from '@/shared/components/actions/Button';
import { Alert } from '@/shared/components/feedback/Alert';
import { TextField } from '@/shared/components/forms/TextField';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';

interface AddAgentAccountDialogProps {
  providers: AgentProvider[];
  busy: boolean;
  actionError: string | null;
  onClose: () => void;
  onConnected: () => void;
  onConnectToken: (provider: string, token: string, name: string) => Promise<boolean>;
}

const FORM_ID = 'add-agent-account';

/**
 * Names a new account and links it: through the provider's own sign-in (Claude OAuth, Codex device
 * code) on a second step, or with a pasted setup token where operators turned sign-in off.
 */
export const AddAgentAccountDialog = ({ providers, busy, actionError, onClose, onConnected, onConnectToken }: AddAgentAccountDialogProps) => {
  const [title, setTitle] = useState('');
  const [providerId, setProviderId] = useState(providers.length === 1 ? providers[0].id : '');
  const [token, setToken] = useState('');
  const [pairing, setPairing] = useState(false);
  const provider = providers.find((entry) => entry.id === providerId);
  const isCodex = Boolean(provider?.modes.includes('device_oauth'));
  const signsIn = isCodex || Boolean(provider?.oauthEnabled);
  const name = title.trim();
  const ready = Boolean(provider && name && (signsIn || token.trim()));
  const connected = () => { onConnected(); onClose(); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!provider || !ready || busy) return;
    if (signsIn) {
      setPairing(true);
      return;
    }
    void onConnectToken(provider.id, token.trim(), name).then((success) => { if (success) onClose(); });
  };

  return (
    <Dialog open onClose={onClose} dismissible={!busy}
      title={pairing && provider ? `Sign in with ${provider.label}` : 'Add agent account'}
      description={pairing ? `Linking “${name}”.` : 'Name the account and choose its provider.'}
      footer={pairing ? (
        <Button variant="ghost" onClick={() => setPairing(false)} disabled={busy}>Back</Button>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="brand" type="submit" form={FORM_ID} loading={busy} disabled={!ready}>
            {signsIn ? 'Continue to sign-in' : 'Connect account'}
          </Button>
        </>
      )}>
      {pairing && provider ? (
        isCodex
          ? <CodexPairing name={name} onConnected={connected} />
          : <ClaudePairing provider={provider.id} name={name} onConnected={connected} />
      ) : (
        <form id={FORM_ID} onSubmit={submit} className="flex flex-col gap-5">
          <TextField label="Account title" value={title} onChange={setTitle} maxLength={100} required
            placeholder="e.g. Claude Ana or Codex work" autoComplete="off" enterKeyHint="next" autoCapitalize="words" />
          {providers.length > 1 ? (
            <div className="flex min-w-0 flex-col gap-2">
              <span id="add-agent-provider" className="text-footnote font-medium text-ink-muted">Provider</span>
              <SegmentedControl labelledBy="add-agent-provider" value={providerId} className="w-full"
                items={providers.map((entry) => ({ id: entry.id, label: entry.label }))}
                onChange={(id) => { setProviderId(id); setToken(''); }} />
            </div>
          ) : null}
          {provider && !signsIn ? (
            <TextField label={`${provider.label} setup token`} type="password" value={token} onChange={setToken} mono
              placeholder="sk-ant-oat01-…" autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="done"
              leading={<KeyRound aria-hidden className="size-4" />}
              hint={<>Create it with <code className="font-mono">claude setup-token</code> on your machine.</>} />
          ) : null}
          {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
        </form>
      )}
    </Dialog>
  );
};
