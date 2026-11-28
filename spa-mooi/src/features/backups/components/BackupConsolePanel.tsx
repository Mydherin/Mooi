import { DatabaseBackup, MessagesSquare, Sparkles } from 'lucide-react';
import { backupOperationLabel } from '@/features/backups/lib/backupOperationLabel';
import type { BackupSnapshot } from '@/features/backups/types/BackupSnapshot';
import { OperationConsole } from '@/features/production/components/operation/OperationConsole';
import { Button } from '@/shared/components/actions/Button';
import { TruncatedText } from '@/shared/components/data-display/TruncatedText';

interface BackupConsolePanelProps {
  snapshot: BackupSnapshot | null;
  logs: string[];
  hasChat: boolean;
  canBackup: boolean;
  onOpenChat: () => void;
  onFix: () => void;
  onBackup: () => void;
}

/** Live output of the current backup operation, with what runs and the next steps once it fails. */
export const BackupConsolePanel = ({ snapshot, logs, hasChat, canBackup, onOpenChat, onFix, onBackup }: BackupConsolePanelProps) => (
  <OperationConsole snapshot={snapshot} logs={logs} label="Backup operation output"
    emptyTitle="No backup output yet"
    emptyDescription="Start a backup or a restore to follow its script live. Past output stays in each backup's detail."
    waitingMessage="waiting for the script…"
    facts={snapshot ? <>
      <span className="font-medium text-ink">{backupOperationLabel(snapshot.action, snapshot.target)}</span>
      {snapshot.releaseTag ? <span className="font-mono font-semibold text-ink">{snapshot.releaseTag}</span> : null}
      {snapshot.backupKey ? <TruncatedText text={snapshot.backupKey} from="start" mono className="min-w-0 max-w-full" /> : null}
    </> : null}
    actions={<>
      <Button variant="secondary" size="sm" icon={hasChat ? MessagesSquare : Sparkles} onClick={hasChat ? onOpenChat : onFix}>{hasChat ? 'Adjust in chat' : 'Fix with agent'}</Button>
      {canBackup && snapshot?.action === 'backup' ? <Button variant="brand" size="sm" icon={DatabaseBackup} onClick={onBackup}>Back up again</Button> : null}
    </>} />
);
