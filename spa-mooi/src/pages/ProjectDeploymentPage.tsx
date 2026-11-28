import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, ExternalLink, KeyRound, Rocket, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { useAgentConnections } from '@/features/agents/hooks/useAgentConnections';
import { PlatformAgentDialog } from '@/features/platform/components/PlatformAgentDialog';
import { PlatformChatPanel } from '@/features/platform/components/PlatformChatPanel';
import { PlatformDeleteDialog } from '@/features/platform/components/PlatformDeleteDialog';
import { PlatformEnvironmentDialog } from '@/features/platform/components/PlatformEnvironmentDialog';
import { PlatformFilesPanel } from '@/features/platform/components/PlatformFilesPanel';
import { usePlatformChat } from '@/features/platform/hooks/usePlatformChat';
import { usePlatformFiles } from '@/features/platform/hooks/usePlatformFiles';
import { usePlatformOperation } from '@/features/platform/hooks/usePlatformOperation';
import type { Project } from '@/features/projects/types/Project';
import {
  deleteProductionConfiguration, deleteProductionDeployment, fetchProductionFileDiff, saveProductionDraft,
  startProductionDeployment, updateProductionEnvironment,
} from '@/features/production/api/productionApi';
import { OperationHeader } from '@/features/production/components/operation/OperationHeader';
import { OperationProjectGate } from '@/features/production/components/operation/OperationProjectGate';
import { OperationSessionPanel } from '@/features/production/components/operation/OperationSessionPanel';
import { ProductionConsolePanel } from '@/features/production/components/ProductionConsolePanel';
import { ProductionDeploymentDetailDialog } from '@/features/production/components/ProductionDeploymentDetailDialog';
import { ProductionOverviewPanel } from '@/features/production/components/ProductionOverviewPanel';
import { ProductionReleaseDialog } from '@/features/production/components/ProductionReleaseDialog';
import { useProductionHealth } from '@/features/production/hooks/useProductionHealth';
import { useProductionOverview } from '@/features/production/hooks/useProductionOverview';
import { useProjectProductionHistory } from '@/features/production/hooks/useProjectProductionHistory';
import { operationTabs } from '@/features/production/lib/operationTabs';
import { PRODUCTION_AGENT_COPY, PRODUCTION_AGENT_SUGGESTIONS } from '@/features/production/lib/productionAgentCopy';
import { productionAgentMessage } from '@/features/production/lib/productionAgentMessage';
import { PRODUCTION_DOCUMENTS } from '@/features/production/lib/productionDocuments';
import { PRODUCTION_FILES_SOURCE } from '@/features/production/lib/productionFilesSource';
import { productionStage } from '@/features/production/lib/productionStage';
import { PRODUCTION_STAGE_VIEWS } from '@/features/production/lib/productionStageView';
import type { OperationTab } from '@/features/production/types/OperationTab';
import type { ProductionAgentIntent } from '@/features/production/types/ProductionAgentIntent';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import type { ProductionHealthState } from '@/features/production/types/ProductionHealthState';
import type { ProductionSnapshot } from '@/features/production/types/ProductionSnapshot';
import type { ReleaseChoice } from '@/features/production/types/ReleaseChoice';
import { closeSession } from '@/features/sessions/api/sessionsApi';
import { Button } from '@/shared/components/actions/Button';
import type { ActionItem } from '@/shared/components/actions/ActionItem';
import { StatusDot } from '@/shared/components/data-display/StatusDot';
import { useTabParam } from '@/shared/components/navigation/useTabParam';
import { useBackLink } from '@/shared/hooks/useBackLink';
import type { BackLink } from '@/shared/types/BackLink';
import { cn } from '@/shared/utils/cn';
import { useSessionsStore } from '@/stores/sessionsStore';

const TAB_IDS: readonly OperationTab[] = ['overview', 'chat', 'console', 'files', 'changes', 'trace'];
const HEALTH_VIEWS: Record<ProductionHealthState, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' }> = {
  unknown: { label: 'Service status unknown', tone: 'neutral' },
  checking: { label: 'Checking the service…', tone: 'info' },
  healthy: { label: 'Service online', tone: 'success' },
  unhealthy: { label: 'Service needs attention', tone: 'danger' },
};

/** One project's production; resolves the project first. */
export const ProjectDeploymentPage = () => {
  const { projectId } = useParams();
  const back = useBackLink({ to: ROUTES.deployments, label: 'Deployments' });
  return <OperationProjectGate projectId={projectId} back={back}>{(project) => <ProductionScreen key={project.id} project={project} back={back} />}</OperationProjectGate>;
};

/**
 * An overview first, then — like a session — views for the deployment chat, the live console, the
 * platform-stored files and the chat's repository changes and trace as they become relevant. The
 * active view lives in `?tab=` so a reload lands back on it.
 */
const ProductionScreen = ({ project, back }: { project: Project; back: BackLink }) => {
  const { connections } = useAgentConnections();
  const stream = usePlatformOperation<ProductionSnapshot>(project.id, 'production');
  const refreshKey = `${stream.configurationRevision}:${stream.snapshot?.operationId ?? ''}:${stream.snapshot?.state ?? ''}`;
  const { overview, error: overviewError, reload } = useProductionOverview(project.id, refreshKey);
  const history = useProjectProductionHistory(project.id, refreshKey);
  const { chat, starting, error: chatError, start, clearError } = usePlatformChat(project.id, 'production');
  const files = usePlatformFiles(project.id, stream.configurationRevision, PRODUCTION_FILES_SOURCE);
  const fetchDiff = useCallback((path: string) => fetchProductionFileDiff(project.id, path), [project.id]);
  const repositoryChanges = useSessionsStore((state) => (chat ? state.byId[chat.id]?.changes?.files.length ?? 0 : 0));
  const snapshot = stream.snapshot ?? overview?.snapshot ?? null;
  const latest = history.deployments[0];
  const stage = overview ? productionStage(overview, snapshot, latest, Boolean(chat)) : 'unconfigured';
  const missing = overview?.environment.filter((variable) => variable.required && !variable.configured).length ?? 0;
  const configured = Boolean(overview?.configured);
  const deployingStage = stage === 'deploying';
  const health = useProductionHealth(project.id, configured && !deployingStage
    && Boolean(overview?.deployed || latest?.state === 'succeeded'));

  const [tab, openTab] = useTabParam(TAB_IDS, 'overview');
  const [agentIntent, setAgentIntent] = useState<ProductionAgentIntent | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detail, setDetail] = useState<ProductionDeployment | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // The chat only lives while the script is being (re)written; once tested for real it may be closed.
  const chatTested = Boolean(chat && overview?.chatTested && overview.chatSessionId === chat.id);
  const chatClosable = chatTested && chat?.status === 'ready' && !chat.pending && !deployingStage;

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
    chat, onCloseChat: chatClosable ? () => void closeChat() : undefined, closeChatLabel: 'Close deployment chat',
    operationId: snapshot?.operationId ?? null, running: snapshot?.state === 'running',
    showFiles: configured || Boolean(chat) || Boolean(files.documents?.draft), pendingFiles: files.summary?.files.length ?? 0, repositoryChanges,
  });
  const view: OperationTab = tabs.some((item) => item.id === tab) ? tab : 'overview';

  const requestDeploy = () => {
    setActionError(null);
    if (missing > 0) setEnvironmentOpen(true);
    else setReleaseOpen(true);
  };

  const deploy = async (choice: ReleaseChoice) => {
    setDeploying(true);
    setActionError(null);
    try {
      stream.adoptSnapshot(await startProductionDeployment(project.id, choice));
      setReleaseOpen(false);
      setDetail(null);
      history.reload();
      openTab('console');
    } catch (failure) {
      setActionError((failure as Error).message);
    } finally {
      setDeploying(false);
    }
  };

  const openAgent = (intent: ProductionAgentIntent) => {
    clearError();
    setAgentIntent(intent);
  };

  const fixFailure = () => (chat ? openTab('chat') : openAgent('fix'));
  const failedRelease = snapshot?.state === 'failed' ? snapshot.releaseTag : latest?.state === 'failed' ? latest.releaseTag : null;
  const stageView = PRODUCTION_STAGE_VIEWS[stage];
  const healthView = HEALTH_VIEWS[health.state];

  const actions: ActionItem[] = [
    ...(configured ? [{ id: 'deploy', label: 'Deploy', icon: Rocket, primary: true, variant: 'brand' as const, loading: deploying || deployingStage,
      disabled: deployingStage, onSelect: requestDeploy }] : []),
    { id: 'variables', label: 'Environment variables', icon: KeyRound, onSelect: () => setEnvironmentOpen(true) },
    ...(configured ? [
      { id: 'reconfigure', label: 'Change deployment', icon: SlidersHorizontal, disabled: deployingStage, onSelect: () => openAgent('update') },
      { id: 'status', label: 'Check service status', icon: Activity, disabled: deployingStage || health.state === 'checking', onSelect: health.check },
    ] : []),
    ...(project.htmlUrl ? [{ id: 'releases', label: 'GitHub releases', icon: ExternalLink, href: `${project.htmlUrl}/releases` }] : []),
    { id: 'delete', label: 'Delete configuration', icon: Trash2, destructive: true, disabled: !configured || deployingStage, onSelect: () => setDeleteOpen(true) },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <OperationHeader back={back} title={project.name} idPrefix="production" tabsLabel="Deployment views"
        status={{ label: stageView.label, tone: stageView.tone, pulse: deployingStage }}
        meta={configured ? <span className="inline-flex items-center gap-1.5"><StatusDot tone={healthView.tone} pulse={health.state === 'checking'} />{healthView.label}</span> : null}
        actions={actions} actionsLabel="More deployment actions" tabs={tabs} tab={view} onTabChange={(next) => openTab(next as OperationTab)} />

      <div role="tabpanel" id={`production-panel-${view}`} aria-labelledby={`production-tab-${view}`} className="relative min-h-0 flex-1 bg-canvas">
        {view === 'overview' ? <ProductionOverviewPanel overview={overview} error={overviewError ?? actionError}
          onRetry={reload} stage={stage} hasChat={Boolean(chat)} missingVariables={missing} releaseTag={latest?.releaseTag ?? null}
          latest={latest} health={health} history={history} deploying={deploying}
          onSetup={() => openAgent('setup')} onDeploy={requestDeploy} onOpenChat={() => openTab('chat')}
          onOpenConsole={() => openTab('console')} onFix={fixFailure} onEnvironment={() => setEnvironmentOpen(true)}
          onOpenDeployment={setDetail} onRedeploy={(deployment) => void deploy({ tag: deployment.releaseTag, create: false })} /> : null}

        {chat ? <div className={cn('h-full', view !== 'chat' && 'hidden')}>
          <PlatformChatPanel key={chat.id} sessionId={chat.id} loadingLabel="Opening the deployment chat…"
            completion={chatClosable ? { done: true, title: 'Tested and deployed.', description: 'Close this chat to accept its platform files.',
              action: <Button variant="brand" size="sm" icon={X} onClick={() => void closeChat()}>Close chat</Button> }
              : configured && missing === 0 && !deployingStage ? { done: false, title: 'The configuration is ready.', description: 'Deploy whenever you want.',
                action: <Button variant="brand" size="sm" icon={Rocket} onClick={requestDeploy}>Deploy</Button> } : null} />
        </div> : null}

        {view === 'console' ? <ProductionConsolePanel snapshot={snapshot} logs={stream.logs} hasChat={Boolean(chat)}
          onOpenChat={() => openTab('chat')} onFix={() => openAgent('fix')} onDeploy={requestDeploy} /> : null}

        {view === 'files' ? <PlatformFilesPanel fields={PRODUCTION_DOCUMENTS} documents={files.documents} summary={files.summary}
          loadError={files.error} locked={deployingStage} fetchDiff={fetchDiff}
          saveDraft={(draft) => saveProductionDraft(project.id, draft)} onSaved={files.reload}
          emptyDescription="The agent saves DEPLOYMENT.md, deploy.sh and status.sh here one by one while it prepares the deployment. They live in Mooi, never in the repository." /> : null}

        {(view === 'changes' || view === 'trace') && chat ? <OperationSessionPanel view={view} sessionId={chat.id}
          changesDescription={`Production Compose and other repository changes appear here. The agent asks before committing them to ${project.defaultBranch}.`} /> : null}
      </div>

      {agentIntent ? <PlatformAgentDialog key={agentIntent} copy={PRODUCTION_AGENT_COPY[agentIntent]} projectName={project.name}
        connections={connections} busy={starting} error={chatError} optionalPrompt={agentIntent === 'fix'}
        suggestions={agentIntent === 'setup' ? PRODUCTION_AGENT_SUGGESTIONS : []}
        replaceNotice={chat ? 'This starts a new deployment chat and closes the current one. The saved configuration is kept.' : null}
        buildMessage={(prompt) => productionAgentMessage(agentIntent, prompt, failedRelease)}
        onClose={() => setAgentIntent(null)} onSubmit={(request) => void start(request).then((session) => {
          if (!session) return;
          setAgentIntent(null);
          files.reload();
          openTab('chat');
        })} /> : null}
      {releaseOpen ? <ProductionReleaseDialog projectId={project.id} defaultBranch={project.defaultBranch} busy={deploying}
        error={actionError} onClose={() => { setReleaseOpen(false); setActionError(null); }} onSelect={(choice) => void deploy(choice)} /> : null}
      {environmentOpen && overview ? <PlatformEnvironmentDialog prefix="MOOI_PRODUCTION_" variables={overview.environment}
        description="Stored encrypted in the platform and passed to deploy.sh and status.sh together with the development values."
        save={(values) => updateProductionEnvironment(project.id, values)}
        onClose={() => setEnvironmentOpen(false)} onSaved={() => { setEnvironmentOpen(false); reload(); }} /> : null}
      {deleteOpen ? <PlatformDeleteDialog title="Delete deployment configuration" action="Delete configuration"
        description={`Removes DEPLOYMENT.md, deploy.sh, status.sh and every stored environment variable of ${project.name}.`}
        consequences={['The service already running in production is not stopped.', 'The deployment history and its saved output stay available.',
          'The deployment chat is closed; setting up again starts from scratch.']}
        remove={() => deleteProductionConfiguration(project.id)} onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          if (chat) useSessionsStore.getState().removeSession(chat.id);
          openTab('overview');
          reload();
        }} /> : null}
      {detail ? <ProductionDeploymentDetailDialog key={detail.operationId} deployment={detail} projectName={project.name}
        onClose={() => setDetail(null)}
        onRedeploy={configured && !deployingStage ? () => void deploy({ tag: detail.releaseTag, create: false }) : undefined}
        onFix={() => { setDetail(null); fixFailure(); }}
        onDelete={async () => {
          await deleteProductionDeployment(project.id, detail.operationId);
          history.remove(detail.operationId);
          setDetail(null);
        }} /> : null}
    </div>
  );
};
