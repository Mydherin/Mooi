import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArchiveRestore, ArrowUpRight, FlaskConical, ShieldCheck, Trash2 } from 'lucide-react';
import { fetchBackupDetail } from '@/features/backups/api/backupHistoryApi';
import { backupOperationLabel } from '@/features/backups/lib/backupOperationLabel';
import type { Backup } from '@/features/backups/types/Backup';
import type { BackupDetail } from '@/features/backups/types/BackupDetail';
import { OperationOutput } from '@/features/production/components/operation/OperationOutput';
import { OperationStateBadge } from '@/features/production/components/operation/OperationStateBadge';
import { OperationStateIcon } from '@/features/production/components/operation/OperationStateIcon';
import { Button } from '@/shared/components/actions/Button';
import { Badge } from '@/shared/components/data-display/Badge';
import { Alert } from '@/shared/components/feedback/Alert';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { SelectField } from '@/shared/components/forms/select/SelectField';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { formatDate } from '@/shared/utils/formatDate';
import { formatDuration } from '@/shared/utils/formatDuration';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';
import { formatTime } from '@/shared/utils/formatTime';

interface BackupDetailDialogProps {
  backup: Backup;
  projectName: string;
  /** Shown from the cross-project history: leads to the project's backup screen. */
  projectTo?: string;
  onClose: () => void;
  onVerify?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}

const VIEWS = [{ id: 'output', label: 'Output' }, { id: 'script', label: 'Script' }];

/** One backup and every operation run on it: what ran, when, how it ended and its redacted output. */
export const BackupDetailDialog = ({ backup, projectName, projectTo, onClose, onVerify, onRestore, onDelete }: BackupDetailDialogProps) => {
  const [detail, setDetail] = useState<BackupDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'output' | 'script'>('output');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchBackupDetail(backup.projectId, backup.id)
      .then((result) => { if (active) setDetail(result); })
      .catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [backup.projectId, backup.id, backup.state, backup.verifiedAt, backup.restoredAt]);

  const operation = detail?.operations.find((item) => item.operation.operationId === selected) ?? detail?.operations[0];
  const content = view === 'script' ? operation?.script ?? '' : operation?.logs.join('\n') || 'No output was recorded.';

  return <Dialog open size="lg" onClose={onClose} title={`${formatDate(backup.startedAt)} · ${formatTime(backup.startedAt)} · ${projectName}`}
    description={`Release ${backup.releaseTag}${backup.finishedAt ? ` · took ${formatDuration(backup.startedAt, backup.finishedAt)}` : ''}`}
    footer={<>
      {onDelete ? <Button variant="ghost" icon={Trash2} onClick={onDelete} className="text-danger sm:mr-auto">Delete backup</Button> : null}
      {projectTo ? <Link to={projectTo} className={buttonStyles('secondary', 'md')}><ArrowUpRight aria-hidden className="size-4" />Open project</Link> : null}
      {onVerify ? <Button variant="secondary" icon={FlaskConical} onClick={onVerify}>Verify</Button> : null}
      {onRestore ? <Button variant="brand" icon={ArchiveRestore} onClick={onRestore}>Restore</Button> : null}
    </>}>
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <OperationStateBadge state={backup.state} />
        {backup.verifiedAt ? <Badge tone="success" icon={ShieldCheck}>Verified {formatRelativeTime(backup.verifiedAt)}</Badge> : null}
        {backup.restoredAt ? <Badge tone="info" icon={ArchiveRestore}>Restored {formatRelativeTime(backup.restoredAt)}</Badge> : null}
      </div>

      {error ? <Alert tone="danger">{error}</Alert>
        : !detail ? <Spinner label="Loading backup…" />
          : operation ? <>
            {detail.operations.length > 1 ? <SelectField label="Operation" value={operation.operation.operationId} onChange={setSelected}
              options={detail.operations.map(({ operation: item }) => ({
                value: item.operationId, label: backupOperationLabel(item.action, item.target),
                description: `${formatRelativeTime(item.startedAt)}${item.finishedAt ? ` · ${formatDuration(item.startedAt, item.finishedAt)}` : ''}`,
                leading: <OperationStateIcon state={item.state} className="size-8" />,
              }))} /> : null}
            {operation.message ? <p className="text-callout break-words text-ink-muted">{operation.message}</p> : null}
            <SegmentedControl items={VIEWS} value={view} onChange={(next) => setView(next as 'output' | 'script')} ariaLabel="Operation content" className="self-start" />
            <OperationOutput content={content} kind={view === 'output' ? 'log' : 'file'} label={view === 'output' ? 'Operation output' : 'Operation script'} />
          </> : <p className="text-callout text-ink-muted">No operation was recorded for this backup.</p>}
    </div>
  </Dialog>;
};
