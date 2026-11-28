import { ExternalLink, MessagesSquare, Rocket, Sparkles } from 'lucide-react';
import { OperationConsole } from '@/features/production/components/operation/OperationConsole';
import type { ProductionSnapshot } from '@/features/production/types/ProductionSnapshot';
import { Button } from '@/shared/components/actions/Button';
import { shortCommit } from '@/shared/utils/shortCommit';

interface ProductionConsolePanelProps {
  snapshot: ProductionSnapshot | null;
  logs: string[];
  hasChat: boolean;
  onOpenChat: () => void;
  onFix: () => void;
  onDeploy: () => void;
}

/** Live output of the current deployment, with its release and the next steps once it fails. */
export const ProductionConsolePanel = ({ snapshot, logs, hasChat, onOpenChat, onFix, onDeploy }: ProductionConsolePanelProps) => (
  <OperationConsole snapshot={snapshot} logs={logs} label="Production deployment output"
    emptyTitle="No deployment output yet"
    emptyDescription="Start a deployment to follow deploy.sh live. Past output stays available in each deployment's detail."
    waitingMessage="waiting for deploy.sh…"
    facts={<>
      {snapshot?.releaseUrl && snapshot.releaseTag ? <a href={snapshot.releaseUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-8 items-center gap-1 font-mono font-semibold text-ink hover-device:hover:underline">{snapshot.releaseTag}<ExternalLink aria-hidden className="size-3" /></a> : null}
      {snapshot?.releaseCommit ? <span className="font-mono">{shortCommit(snapshot.releaseCommit)}</span> : null}
    </>}
    actions={<>
      <Button variant="secondary" size="sm" icon={hasChat ? MessagesSquare : Sparkles} onClick={hasChat ? onOpenChat : onFix}>{hasChat ? 'Adjust in chat' : 'Fix with agent'}</Button>
      <Button variant="brand" size="sm" icon={Rocket} onClick={onDeploy}>Deploy again</Button>
    </>} />
);
