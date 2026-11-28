import { useRef, useState, type FormEvent } from 'react';
import { accountName } from '@/features/agents/lib/accountName';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import { Button } from '@/shared/components/actions/Button';
import { Alert } from '@/shared/components/feedback/Alert';
import { TextField } from '@/shared/components/forms/TextField';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';

interface RenameAgentAccountDialogProps {
  connection: AgentConnection;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onRename: (id: string, name: string) => void;
}

const FORM_ID = 'rename-agent-account';

/** A new title to recognize an account by; typing is the point, so the field takes focus. */
export const RenameAgentAccountDialog = ({ connection, busy, error, onClose, onRename }: RenameAgentAccountDialogProps) => {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(() => accountName(connection));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() && !busy) onRename(connection.id, name.trim());
  };

  return (
    <Dialog open onClose={onClose} size="sm" dismissible={!busy}
      title="Rename account" description="Choose a title to recognize this account." initialFocus={input}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="brand" type="submit" form={FORM_ID} loading={busy} disabled={!name.trim()}>Save</Button>
      </>}>
      <form id={FORM_ID} onSubmit={submit} className="flex flex-col gap-4">
        <TextField ref={input} label="Account title" value={name} onChange={setName} maxLength={100} required
          autoComplete="off" enterKeyHint="done" autoCapitalize="words" />
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </Dialog>
  );
};
