import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DatabaseBackup, KeyRound, Rocket, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { deploymentPath } from '@/app/paths';
import { ROUTES } from '@/app/routes';
import { useAgentConnections } from '@/features/agents/hooks/useAgentConnections';
import {
  createBackup, deleteBackupConfiguration, deleteBackupData, fetchBackupFileDiff, forgetBackup, restoreBackup,
  saveBackupDraft, updateBackupEnvironment,
} from '@/features/backups/api/backupsApi';
import { BackupConsolePanel } from '@/features/backups/components/BackupConsolePanel';
import { BackupDeleteDialog } from '@/features/backups/components/BackupDeleteDialog';
import { BackupDetailDialog } from '@/features/backups/components/BackupDetailDialog';
import { BackupOverviewPanel } from '@/features/backups/components/BackupOverviewPanel';
import { BackupRestoreDialog } from '@/features/backups/components/BackupRestoreDialog';
import { useBackupOverview } from '@/features/backups/hooks/useBackupOverview';
import { useProjectBackups } from '@/features/backups/hooks/useProjectBackups';
import { BACKUP_AGENT_COPY, BACKUP_AGENT_SUGGESTIONS } from '@/features/backups/lib/backupAgentCopy';
import { backupAgentMessage } from '@/features/backups/lib/backupAgentMessage';
import { BACKUP_DOCUMENTS } from '@/features/backups/lib/backupDocuments';
import { BACKUP_FILES_SOURCE } from '@/features/backups/lib/backupFilesSource';
import { backupOperationLabel } from '@/features/backups/lib/backupOperationLabel';
import { backupStage } from '@/features/backups/lib/backupStage';
import { BACKUP_STAGE_VIEWS } from '@/features/backups/lib/backupStageView';
import type { Backup } from '@/features/backups/types/Backup';
import type { BackupAgentIntent } from '@/features/backups/types/BackupAgentIntent';
import type { BackupSnapshot } from '@/features/backups/types/BackupSnapshot';
import { PlatformAgentDialog } from '@/features/platform/components/PlatformAgentDialog';
import { PlatformChatPanel } from '@/features/platform/components/PlatformChatPanel';
import { PlatformDeleteDialog } from '@/features/platform/components/PlatformDeleteDialog';
import { PlatformEnvironmentDialog } from '@/features/platform/components/PlatformEnvironmentDialog';
import { PlatformFilesPanel } from '@/features/platform/components/PlatformFilesPanel';
import { usePlatformChat } from '@/features/platform/hooks/usePlatformChat';
import { usePlatformFiles } from '@/features/platform/hooks/usePlatformFiles';
import { usePlatformOperation } from '@/features/platform/hooks/usePlatformOperation';
import { OperationHeader } from '@/features/production/components/operation/OperationHeader';
import { OperationProjectGate } from '@/features/production/components/operation/OperationProjectGate';
import { OperationSessionPanel } from '@/features/production/components/operation/OperationSessionPanel';
import { operationTabs } from '@/features/production/lib/operationTabs';
import type { OperationTab } from '@/features/production/types/OperationTab';
import type { Project } from '@/features/projects/types/Project';
import { closeSession } from '@/features/sessions/api/sessionsApi';
import type { ActionItem } from '@/shared/components/actions/ActionItem';
import { Button } from '@/shared/components/actions/Button';
import { useTabParam } from '@/shared/components/navigation/useTabParam';
import { useBackLink } from '@/shared/hooks/useBackLink';
import type { BackLink } from '@/shared/types/BackLink';
import { cn } from '@/shared/utils/cn';
import { useSessionsStore } from '@/stores/sessionsStore';

const TAB_IDS: readonly OperationTab[] = ['overview', 'chat', 'console', 'files', 'changes', 'trace'];

/** One project's backups; resolves the project first. */
export const ProjectBackupPage = () => {
  const { projectId } = useParams();
  const back = useBackLink({ to: ROUTES.backups, label: 'Backups' });
  return <OperationProjectGate projectId={projectId} back={back}>{(project) => <BackupScreen key={project.id} project={project} back={back} />}</OperationProjectGate>;
};

/**
 * Shaped like the deployment screen: an overview first, then views for the backup chat, the live
 * console, the platform-stored files and the chat's repository changes and trace as they become
 * relevant. The active view lives in `?tab=` so a reload lands back on it.
 */
const BackupScreen = ({ project, back }: { project: Project; back: BackLink }) => {
  const { connections } = useAgentConnections();
  const stream = usePlatformOperation<BackupSnapshot>(project.id, 'backup');
  const refreshKey = `${stream.configurationRevision}:${stream.snapshot?.operationId ?? ''}:${stream.snapshot?.state ?? ''}`;
  const { overview, error: overviewError, reload } = useBackupOverview(project.id, refreshKey);
  const list = useProjectBackups(project.id, refreshKey);
  const { chat, starting, error: chatError, start, clearError } = usePlatformChat(project.id, 'backup');
  const files = usePlatformFiles(project.id, stream.configurationRevision, BACKUP_FILES_SOURCE);
  const fetchDiff = useCallback((path: string) => fetchBackupFileDiff(project.id, path), [project.id]);
  const repositoryChanges = useSessionsStore((state) => (chat ? state.byId[chat.id]?.changes?.files.length ?? 0 : 0));
  const snapshot = stream.snapshot ?? overview?.snapshot ?? null;
  const stage = overview ? backupStage(overview, snapshot, list.backups[0], Boolean(chat)) : 'unconfigured';
  const missing = overview?.environment.filter((variable) => variable.required && !variable.configured).length ?? 0;
  const configured = Boolean(overview?.configured);
  const running = stage === 'running';

  const [tab, openTab] = useTabParam(TAB_IDS, 'overview');
  const [agentIntent, setAgentIntent] = useState<BackupAgentIntent | null>(null);
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detail, setDetail] = useState<Backup | null>(null);
  const [restoring, setRestoring] = useState<Backup | null>(null);
  const [removing, setRemoving] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // The chat only lives while the scripts are being (re)written; once proven it may be closed.
  const chatTested = Boolean(chat && overview?.chatTested && overview.chatSessionId === chat.id);
  const chatClosable = chatTested && chat?.status === 'ready' && !chat.pending && !running;

  const closeChat = async () => {
    if (!chat) return;
    setActionError(null);
    try {
      await closeSession(chat.id);
      useSessionsStore.getState().removeSession(chat.id);
      if (tab === 'chat') openTab('overview');
      reload();
      files.reload();
    } catch (failure) {
      setActionError((failure as Error).message);
    }
  };

  const tabs = operationTabs({
    chat, onCloseChat: chatClosable ? () => void closeChat() : undefined, closeChatLabel: 'Close backup chat',
    operationId: snapshot?.operationId ?? null, running: snapshot?.state === 'running',
    showFiles: configured || Boolean(chat) || Boolean(files.documents?.draft), pendingFiles: files.summary?.files.length ?? 0, repositoryChanges,
  });
  const view: OperationTab = tabs.some((item) => item.id === tab) ? tab : 'overview';

  /** Starts one operation and follows it in the console; errors stay on the overview. */
  const operate = async (operation: () => Promise<BackupSnapshot>): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
    try {
      stream.adoptSnapshot(await operation());
      setDetail(null);
      list.reload();
      openTab('console');
      return true;
    } catch (failure) {
      setActionError((failure as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const requestBackup = () => {
    if (missing > 0) setEnvironmentOpen(true);
    else void operate(() => createBackup(project.id));
  };
  const verify = (backup: Backup) => void operate(() => restoreBackup(project.id, backup.id, 'verification'));
  const openAgent = (intent: BackupAgentIntent) => {
    clearError();
    setAgentIntent(intent);
  };
  const fixFailure = () => (chat ? openTab('chat') : openAgent('fix'));
  const failed = snapshot?.state === 'failed' ? backupOperationLabel(snapshot.action, snapshot.target).toLowerCase() : null;
  const stageView = BACKUP_STAGE_VIEWS[stage];
  const deployedRelease = overview?.deployedRelease ?? null;
  const actions: ActionItem[] = [
    ...(overview?.active ? [{ id: 'backup', label: 'Create backup', icon: DatabaseBackup, primary: true, variant: 'brand' as const,
      loading: busy || running, disabled: running || !deployedRelease, onSelect: requestBackup }] : []),
    { id: 'variables', label: 'Environment variables', icon: KeyRound, onSelect: () => setEnvironmentOpen(true) },
    ...(configured ? [{ id: 'reconfigure', label: 'Change backups', icon: SlidersHorizontal, disabled: running, onSelect: () => openAgent('update') }] : []),
    { id: 'production', label: 'Production deployment', icon: Rocket, to: deploymentPath(project.id) },
    { id: 'delete', label: 'Delete configuration', icon: Trash2, destructive: true, disabled: !configured || running, onSelect: () => setDeleteOpen(true) },
  ];
  const actionable = (backup: Backup) => Boolean(overview?.active) && !running && !busy && backup.state === 'succeeded';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <OperationHeader back={back} title={project.name} idPrefix="backup" tabsLabel="Backup views"
        status={{ label: stageView.label, tone: stageView.tone, pulse: running }}
        meta={deployedRelease ? <span className="inline-flex items-center gap-1.5"><Rocket aria-hidden className="size-3.5" />Production runs <span className="font-mono">{deployedRelease}</span></span> : null}
        actions={actions} actionsLabel="More backup actions" tabs={tabs} tab={view} onTabChange={(next) => openTab(next as OperationTab)} />

      <div role="tabpanel" id={`backup-panel-${view}`} aria-labelledby={`backup-tab-${view}`} className="relative min-h-0 flex-1 bg-canvas">
        {view === 'overview' ? <BackupOverviewPanel projectId={project.id} overview={overview} error={overviewError ?? actionError} onRetry={reload}
          stage={stage} hasChat={Boolean(chat)} missingVariables={missing} list={list} busy={busy}
          onSetup={() => openAgent('setup')} onBackup={requestBackup} onOpenChat={() => openTab('chat')} onOpenConsole={() => openTab('console')}
          onFix={fixFailure} onEnvironment={() => setEnvironmentOpen(true)} onOpenBackup={setDetail} onVerify={verify}
          onRestore={setRestoring} onDelete={setRemoving} /> : null}

        {chat ? <div className={cn('h-full', view !== 'chat' && 'hidden')}>
          <PlatformChatPanel key={chat.id} sessionId={chat.id} loadingLabel="Opening the backup chat…"
            completion={chatClosable ? { done: true, title: 'Backed up and verified.', description: 'Close this chat to accept its platform files.',
              action: <Button variant="brand" size="sm" icon={X} onClick={() => void closeChat()}>Close chat</Button> } : null} />
        </div> : null}

        {view === 'console' ? <BackupConsolePanel snapshot={snapshot} logs={stream.logs} hasChat={Boolean(chat)}
          canBackup={Boolean(overview?.active) && !running} onOpenChat={() => openTab('chat')} onFix={() => openAgent('fix')}
          onBackup={requestBackup} /> : null}

        {view === 'files' ? <PlatformFilesPanel fields={BACKUP_DOCUMENTS} documents={files.documents} summary={files.summary}
          loadError={files.error} locked={running} fetchDiff={fetchDiff}
          saveDraft={(draft) => saveBackupDraft(project.id, draft)} onSaved={files.reload}
          emptyDescription="The agent saves BACKUP.md, backup.sh, restore.sh and delete.sh here one by one while it prepares the backups. They live in Mooi, never in the repository." /> : null}

        {(view === 'changes' || view === 'trace') && chat ? <OperationSessionPanel view={view} sessionId={chat.id}
          changesDescription={`Backups rarely need repository changes. When they do, the agent asks before committing them to ${project.defaultBranch}.`} /> : null}
      </div>

      {agentIntent ? <PlatformAgentDialog key={agentIntent} copy={BACKUP_AGENT_COPY[agentIntent]} projectName={project.name}
        connections={connections} busy={starting} error={chatError} optionalPrompt={agentIntent === 'fix'}
        suggestions={agentIntent === 'setup' ? BACKUP_AGENT_SUGGESTIONS : []}
        replaceNotice={chat ? 'This starts a new backup chat and closes the current one. The saved configuration is kept.' : null}
        buildMessage={(prompt) => backupAgentMessage(agentIntent, prompt, failed)}
        onClose={() => setAgentIntent(null)} onSubmit={(request) => void start(request).then((session) => {
          if (!session) return;
          setAgentIntent(null);
          files.reload();
          openTab('chat');
        })} /> : null}
      {environmentOpen && overview ? <PlatformEnvironmentDialog prefix="MOOI_BACKUP_" variables={overview.environment}
        description="Stored encrypted in the platform and passed to backup.sh, restore.sh and delete.sh together with the production and development values."
        save={(values) => updateBackupEnvironment(project.id, values)}
        onClose={() => setEnvironmentOpen(false)} onSaved={() => { setEnvironmentOpen(false); reload(); }} /> : null}
      {deleteOpen ? <PlatformDeleteDialog title="Delete backup configuration" action="Delete configuration"
        description={`Removes BACKUP.md, backup.sh, restore.sh, delete.sh and every stored backup variable of ${project.name}.`}
        consequences={['Stored backups and their records stay; without delete.sh they can only be forgotten.',
          'Production and its deployment configuration are not touched.', 'The backup chat is closed; setting up again starts from scratch.']}
        remove={() => deleteBackupConfiguration(project.id)} onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          if (chat) useSessionsStore.getState().removeSession(chat.id);
          openTab('overview');
          reload();
        }} /> : null}
      {detail ? <BackupDetailDialog key={detail.id} backup={detail} projectName={project.name} onClose={() => setDetail(null)}
        onVerify={actionable(detail) ? () => verify(detail) : undefined}
        onRestore={actionable(detail) && detail.releaseTag === overview?.deployedRelease ? () => { setRestoring(detail); setDetail(null); } : undefined}
        onDelete={detail.state !== 'running' ? () => { setRemoving(detail); setDetail(null); } : undefined} /> : null}
      {restoring ? <BackupRestoreDialog key={restoring.id} backup={restoring} projectName={project.name} busy={busy} error={actionError}
        onClose={() => { setRestoring(null); setActionError(null); }}
        onConfirm={() => void operate(() => restoreBackup(project.id, restoring.id, 'production')).then((ok) => { if (ok) setRestoring(null); })} /> : null}
      {removing ? <BackupDeleteDialog key={removing.id} backup={removing} canRunScript={Boolean(overview?.active) && !running && !busy}
        onClose={() => setRemoving(null)}
        onDelete={async () => {
          stream.adoptSnapshot(await deleteBackupData(project.id, removing.id));
          setRemoving(null);
          openTab('console');
        }}
        onForget={async () => {
          await forgetBackup(project.id, removing.id);
          setRemoving(null);
          list.reload();
        }} /> : null}
    </div>
  );
};
