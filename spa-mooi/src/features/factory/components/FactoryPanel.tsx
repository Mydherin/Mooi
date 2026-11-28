import { useState } from 'react';
import { Factory as FactoryIcon } from 'lucide-react';
import { useAgentConnections } from '@/features/agents/hooks/useAgentConnections';
import {
  approveFactory, deleteFactory, openFactoryChat, pauseFactory, resumeFactory, startFactory,
} from '@/features/factory/api/factoryApi';
import { FactoryActiveStep } from '@/features/factory/components/FactoryActiveStep';
import { FactoryChangeRequests } from '@/features/factory/components/FactoryChangeRequests';
import { FactoryChatCard } from '@/features/factory/components/FactoryChatCard';
import { FactoryDefinition } from '@/features/factory/components/FactoryDefinition';
import { FactoryHeader } from '@/features/factory/components/FactoryHeader';
import { FactoryIntro } from '@/features/factory/components/FactoryIntro';
import { FactoryJournal } from '@/features/factory/components/FactoryJournal';
import { FactoryRoadmap } from '@/features/factory/components/FactoryRoadmap';
import { FactoryRunDialog } from '@/features/factory/components/FactoryRunDialog';
import { useProjectFactory } from '@/features/factory/hooks/useProjectFactory';
import { FACTORY_CHAT_COPY } from '@/features/factory/lib/factoryChatCopy';
import type { FactoryIssue } from '@/features/factory/types/FactoryIssue';
import type { FactoryRunConfig } from '@/features/factory/types/FactoryRunConfig';
import { PlatformAgentDialog } from '@/features/platform/components/PlatformAgentDialog';
import { PlatformDeleteDialog } from '@/features/platform/components/PlatformDeleteDialog';
import type { PlatformChatRequest } from '@/features/platform/types/PlatformChatRequest';
import type { Project } from '@/features/projects/types/Project';
import { Card } from '@/shared/components/data-display/Card';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { useLiveStore } from '@/stores/liveStore';
import { useSessionsStore } from '@/stores/sessionsStore';

type Dialog = 'chat' | 'start' | 'resume' | 'remove' | null;

/**
 * The project's Software Factory tab. Every control runs the same operation the factory chat can
 * call, and both sides follow `factory.updated` live: what one does, the other shows at once.
 */
export const FactoryPanel = ({ project }: { project: Project }) => {
  const { factory, error, adopt } = useProjectFactory(project.id);
  const { connections } = useAgentConnections();
  const chat = useSessionsStore((state) => (factory?.chatSessionId
    ? state.sessions.find((session) => session.id === factory.chatSessionId && session.status !== 'closed') : undefined));
  const announced = useLiveStore((live) => live.configurations[`factory:${project.id}`] ?? 0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** A refused approval's issues, valid only while the plan it read is still the published one. */
  const [refusal, setRefusal] = useState<{ planCommit: string | null; issues: FactoryIssue[] } | null>(null);

  const act = async (key: string, action: () => Promise<void>): Promise<boolean> => {
    setBusy(key);
    setActionError(null);
    try {
      await action();
      return true;
    } catch (failure) {
      setActionError((failure as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const open = (next: Dialog) => { setActionError(null); setDialog(next); };

  if (factory === undefined) {
    return error
      ? <EmptyState icon={FactoryIcon} title="Factory unavailable" description={error} />
      : <Card className="h-56 animate-pulse-soft" />;
  }

  const openChat = (request: PlatformChatRequest) => void act('chat', async () => {
    const opened = await openFactoryChat(project.id, { provider: request.provider, adapter: request.adapter,
      connectionId: request.connectionId, model: request.model, effort: request.effort, request: request.message || undefined });
    adopt(opened.factory);
    setDialog(null);
  });

  const run = (mode: 'start' | 'resume', config: FactoryRunConfig) => void act(mode, async () => {
    adopt(await (mode === 'start' ? startFactory(project.id, config) : resumeFactory(project.id, config)));
    setDialog(null);
  });

  const approve = () => void act('approve', async () => {
    const approval = await approveFactory(project.id);
    adopt(approval.factory);
    setRefusal({ planCommit: approval.factory.planCommit, issues: approval.issues });
  });

  const pause = (mode: 'graceful' | 'immediate') => void act(mode === 'graceful' ? 'pause' : 'stop', async () => {
    adopt(await pauseFactory(project.id, mode));
  });

  const copy = FACTORY_CHAT_COPY[factory === null || factory.status === 'defining' ? 'define' : 'steer'];
  const dialogs = <>
    {dialog === 'chat' ? <PlatformAgentDialog copy={copy} projectName={project.name} connections={connections}
      busy={busy === 'chat'} error={actionError} optionalPrompt buildMessage={(prompt) => prompt.trim()}
      replaceNotice={chat ? 'This opens a new factory chat and closes the current one. The documents and the factory are kept.' : null}
      onClose={() => setDialog(null)} onSubmit={openChat} /> : null}
    {dialog === 'start' || dialog === 'resume' ? <FactoryRunDialog
      title={dialog === 'start' ? 'Start the factory' : 'Resume the factory'}
      description={`${project.name} · the agent that runs every session from now on`}
      action={dialog === 'start' ? 'Start' : 'Resume'} connections={connections} previous={factory?.runConfig ?? null}
      busy={busy === dialog} error={actionError} onClose={() => setDialog(null)} onSubmit={(config) => run(dialog, config)} /> : null}
    {dialog === 'remove' ? <PlatformDeleteDialog title="Remove the factory" action="Remove factory"
      description={`Removes the Software Factory of ${project.name} from Mooi.`}
      consequences={['The documents in docs/factory/ and every milestone branch stay in the repository.',
        'The journal, change requests and the factory chat are removed.', 'Defining a new factory starts from its documents again.']}
      remove={() => deleteFactory(project.id)} onClose={() => setDialog(null)}
      onDeleted={() => { setDialog(null); adopt(null); }} /> : null}
  </>;

  if (factory === null) {
    return <><FactoryIntro onEnable={() => open('chat')} />{dialogs}</>;
  }

  if (factory.status === 'defining' || factory.status === 'ready') {
    return <>
      <FactoryDefinition project={project} factory={factory} chat={chat} approving={busy === 'approve'}
        approvalIssues={refusal?.planCommit === factory.planCommit ? refusal.issues : []} actionError={dialog ? null : actionError} onOpenChat={() => open('chat')}
        onApprove={approve} onStart={() => open('start')} />
      {dialogs}
    </>;
  }

  const revision = String(factory.revision);
  const branch = project.defaultBranch ?? 'main';

  return (
    <div className="flex flex-col gap-4">
      <FactoryHeader factory={factory} busy={busy === 'pause' || busy === 'stop' ? busy : null}
        actionError={dialog ? null : actionError} onPause={pause} onResume={() => open('resume')}
        onOpenChat={() => open('chat')} onRemove={() => open('remove')} />
      {chat ? <FactoryChatCard projectId={project.id} title="Factory chat" chat={chat} onOpenChat={() => open('chat')}
        className="h-[min(60dvh,36rem)] min-h-[22rem]" /> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <FactoryRoadmap phases={factory.plan?.phases ?? []} activeStep={factory.activeStep} />
        <div className="flex min-w-0 flex-col gap-4">
          <FactoryActiveStep factory={factory} />
          <FactoryChangeRequests projectId={project.id} revision={`${revision}:${announced}`} fullName={project.fullName} branch={branch} />
        </div>
      </div>
      <FactoryJournal projectId={project.id} revision={revision} live={factory.status === 'running' || factory.status === 'pausing'} />
      {dialogs}
    </div>
  );
};
