import { useEffect, useState } from 'react';
import { ExternalLink, LoaderCircle } from 'lucide-react';
import { startCodexAuthorization, pollCodexAuthorization, cancelCodexAuthorization } from '@/features/agents/api/codexApi';
import type { CodexAuthorization } from '@/features/agents/types/CodexAuthorization';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';

interface CodexConnectDialogProps {
  onClose: () => void;
  onConnected: () => void;
}

export const CodexConnectDialog = ({ onClose, onConnected }: CodexConnectDialogProps) => {
  const [attempt, setAttempt] = useState<CodexAuthorization | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    let current: CodexAuthorization | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (cause: unknown) => {
      if (!disposed) setError(cause instanceof Error ? cause.message : 'Could not link Codex. Try again.');
    };
    const poll = async () => {
      if (!current || disposed) return;
      try {
        const status = await pollCodexAuthorization(current.id);
        if (disposed) return;
        if (status === 'connected') {
          current = null;
          onConnected();
          onClose();
        } else if (['failed', 'expired', 'cancelled'].includes(status)) {
          setError('The login could not be completed. Close this window and try again.');
        } else timer = setTimeout(() => void poll(), 2000);
      } catch (cause) { fail(cause); }
    };
    const startTimer = setTimeout(() => void startCodexAuthorization().then((value) => {
      current = value;
      if (disposed) { void cancelCodexAuthorization(value.id).catch(() => {}); return; }
      setAttempt(value);
      void poll();
    }).catch(fail), 0);
    return () => {
      disposed = true;
      clearTimeout(startTimer);
      clearTimeout(timer);
      if (current) void cancelCodexAuthorization(current.id).catch(() => {});
    };
    // One login attempt per mounted dialog; parent callbacks do not restart authorization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Modal open onClose={onClose} title="Connect Codex" description="Sign in with your ChatGPT account."
    footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : attempt ?
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Open the secure sign-in page and enter this code. This window will update when your account is linked.</p>
        <code className="select-all rounded-xl bg-surface-2 p-4 text-center text-xl font-semibold tracking-widest text-ink">{attempt.userCode}</code>
        <a href={attempt.verificationUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">
          Continue with ChatGPT <ExternalLink className="size-4" />
        </a>
        <p className="text-xs text-ink-subtle">If prompted, enable device code sign-in in your ChatGPT security settings. The code expires after a few minutes.</p>
      </div> : <p role="status" className="flex items-center gap-2 text-sm text-ink-muted"><LoaderCircle className="size-4 animate-spin" /> Preparing secure sign-in…</p>}
  </Modal>;
};
