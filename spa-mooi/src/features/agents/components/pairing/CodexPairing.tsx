import { ExternalLink } from 'lucide-react';
import { PairingPreparing } from '@/features/agents/components/pairing/PairingPreparing';
import { PairingStep } from '@/features/agents/components/pairing/PairingStep';
import { useCodexDeviceSignIn } from '@/features/agents/hooks/useCodexDeviceSignIn';
import { CopyButton } from '@/shared/components/actions/CopyButton';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { Alert } from '@/shared/components/feedback/Alert';
import { buttonStyles } from '@/shared/styles/buttonStyles';

interface CodexPairingProps {
  name: string;
  /** Signs this existing account in again instead of adding one. */
  connectionId?: string;
  onConnected: () => void;
}

/** The Codex device-code sign-in: the player enters the code on OpenAI's page and this view follows it. */
export const CodexPairing = ({ name, connectionId, onConnected }: CodexPairingProps) => {
  const { attempt, error } = useCodexDeviceSignIn(name, connectionId, onConnected);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!attempt) return <PairingPreparing />;

  return (
    <div className="flex animate-fade-up flex-col gap-5">
      <PairingStep index={1} title="Copy this code" description="It expires after a few minutes.">
        <div className="flex items-center gap-2 rounded-card border border-line bg-surface-2 py-2 pr-2 pl-4">
          <code className="min-w-0 flex-1 truncate font-mono text-title tracking-[0.2em] text-ink select-all">{attempt.userCode}</code>
          <CopyButton value={attempt.userCode} label="Copy code" />
        </div>
      </PairingStep>
      <PairingStep index={2} title="Enter it on ChatGPT"
        description="If asked, enable device code sign-in in your ChatGPT security settings.">
        <a href={attempt.verificationUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles('brand', 'lg', 'w-full')}>
          Continue with ChatGPT <ExternalLink aria-hidden className="size-4" />
        </a>
      </PairingStep>
      <p role="status" className="flex items-center justify-center gap-2 text-footnote text-ink-muted">
        <Spinner /> Waiting for ChatGPT, this view updates once linked.
      </p>
    </div>
  );
};
