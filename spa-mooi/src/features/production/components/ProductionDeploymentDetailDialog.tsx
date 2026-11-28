import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { fetchProductionDeploymentDetail } from '@/features/production/api/productionHistoryApi';
import { OperationOutput } from '@/features/production/components/operation/OperationOutput';
import { OperationStateBadge } from '@/features/production/components/operation/OperationStateBadge';
import { PRODUCTION_DOCUMENTS } from '@/features/production/lib/productionDocuments';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import type { ProductionDeploymentDetail } from '@/features/production/types/ProductionDeploymentDetail';
import type { ProductionFiles } from '@/features/production/types/ProductionFiles';
import { Button } from '@/shared/components/actions/Button';
import { Alert } from '@/shared/components/feedback/Alert';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { Tabs } from '@/shared/components/navigation/Tabs';
import { ConfirmDialog } from '@/shared/components/overlays/confirm/ConfirmDialog';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { formatDate } from '@/shared/utils/formatDate';
import { formatDuration } from '@/shared/utils/formatDuration';
import { formatTime } from '@/shared/utils/formatTime';

interface ProductionDeploymentDetailDialogProps {
  deployment: ProductionDeployment;
  projectName: string;
  /** Shown from the cross-project history: leads to the project's production screen. */
  projectTo?: string;
  onClose: () => void;
  onRedeploy?: () => void;
  onFix?: () => void;
  onDelete?: () => Promise<void>;
}

type DetailView = keyof ProductionFiles | 'output';

/** One recorded attempt: its result, the exact files it ran and its redacted output. */
export const ProductionDeploymentDetailDialog = ({ deployment, projectName, projectTo, onClose, onRedeploy, onFix, onDelete }: ProductionDeploymentDetailDialogProps) => {
  const [detail, setDetail] = useState<ProductionDeploymentDetail | null>(null);
  const [view, setView] = useState<DetailView>('output');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchProductionDeploymentDetail(deployment.projectId, deployment.operationId)
      .then((result) => { if (active) setDetail(result); })
      .catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [deployment.projectId, deployment.operationId]);

  const remove = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try { await onDelete(); }
    catch (failure) { setDeleteError((failure as Error).message); setDeleting(false); }
  };

  const files = detail?.files;
  const views = [{ id: 'output', label: 'Output' },
    ...PRODUCTION_DOCUMENTS.filter(({ key }) => Boolean(files?.[key])).map(({ key, name }) => ({ id: key, label: name }))];
  const content = view === 'output' ? (detail?.logs.join('\n') || 'No output was recorded.') : files?.[view] ?? '';
  const finished = deployment.finishedAt;
  const settled = deployment.state !== 'running';

  return <>
    <Dialog open size="lg" onClose={onClose} title={`${deployment.releaseTag} · ${projectName}`}
      description={`${formatDate(deployment.startedAt)} at ${formatTime(deployment.startedAt)}${finished ? ` · took ${formatDuration(deployment.startedAt, finished)}` : ''}`}
      footer={<>
        {onDelete && settled ? <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)} className="text-danger sm:mr-auto">Delete from history</Button> : null}
        {projectTo ? <Link to={projectTo} className={buttonStyles('secondary', 'md')}><ArrowUpRight aria-hidden className="size-4" />Open project</Link> : null}
        {onFix && deployment.state === 'failed' ? <Button variant="secondary" icon={Sparkles} onClick={onFix}>Fix with agent</Button> : null}
        {onRedeploy && settled ? <Button variant="brand" icon={RotateCcw} onClick={onRedeploy}>Redeploy</Button> : null}
      </>}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <OperationStateBadge state={deployment.state} />
          {detail?.message ? <p className="min-w-0 flex-1 text-callout break-words text-ink-muted">{detail.message}</p> : null}
        </div>
        {error ? <Alert tone="danger">{error}</Alert>
          : !detail ? <Spinner label="Loading deployment…" />
            : <>
              {views.length > 1 ? <Tabs items={views} value={view} onChange={(next) => setView(next as DetailView)} ariaLabel="Deployment content" /> : null}
              <OperationOutput content={content} kind={view === 'output' ? 'log' : 'file'} label={views.find((item) => item.id === view)?.label ?? 'Output'} />
              {!files ? <p className="text-footnote text-ink-subtle">This attempt predates saved file snapshots.</p> : null}
            </>}
      </div>
    </Dialog>
    <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => void remove()} tone="danger" busy={deleting}
      error={deleteError} title="Delete from history?" confirmLabel="Delete saved data" cancelLabel="Keep it"
      description="Removes this entry, its files and its output from Mooi. The deployed service and the current configuration stay in place." />
  </>;
};
