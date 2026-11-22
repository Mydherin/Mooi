import { CircleCheck, LoaderCircle, Play, Stamp } from 'lucide-react';
import { FactoryChatCard } from '@/features/factory/components/FactoryChatCard';
import { FactoryChecklist } from '@/features/factory/components/FactoryChecklist';
import type { Factory } from '@/features/factory/types/Factory';
import type { FactoryIssue } from '@/features/factory/types/FactoryIssue';
import type { Project } from '@/features/projects/types/Project';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { Eyebrow } from '@/shared/components/Eyebrow';

interface FactoryDefinitionProps {
  project: Project;
  factory: Factory;
  /** The live factory chat, if any. */
  chat: Session | undefined;
  approving: boolean;
  approvalIssues: FactoryIssue[];
  actionError: string | null;
  onOpenChat: () => void;
  onApprove: () => void;
  onStart: () => void;
}

/**
 * Defining (and approved, not started yet): the architect chat beside the definition as published on
 * the default branch. Approving here and asking the chat to approve run the same gate.
 */
export const FactoryDefinition = ({ project, factory, chat, approving, approvalIssues, actionError, onOpenChat, onApprove,
  onStart }: FactoryDefinitionProps) => {
  const branch = project.defaultBranch ?? 'main';
  const approved = factory.status === 'ready';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <FactoryChatCard projectId={project.id} title={approved ? 'Factory chat' : 'Definition chat · architect'} chat={chat}
        onOpenChat={onOpenChat} className="h-[min(72dvh,46rem)] min-h-[26rem]" />

      <Card className="flex h-fit flex-col gap-5 p-5">
        <div>
          <Eyebrow>{approved ? 'Approved' : 'Definition'}</Eyebrow>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            {approved
              ? 'The definition is approved. Start the factory with the agent that runs its sessions.'
              : `The architect writes the documents in docs/factory/ and publishes them to ${branch}. Approve once you agree with them.`}
          </p>
        </div>
        <FactoryChecklist plan={factory.plan} issues={approved ? [] : approvalIssues} fullName={project.fullName} branch={branch} />
        {actionError ? <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[12.5px] text-danger">{actionError}</p> : null}
        {approved ? (
          <Button variant="brand" onClick={onStart}><Play className="size-4" />Start the factory</Button>
        ) : (
          <Button variant="brand" onClick={onApprove} disabled={approving}>
            {approving ? <LoaderCircle className="size-4 animate-spin" /> : <Stamp className="size-4" />}
            Approve definition
          </Button>
        )}
        {approved ? <p className="flex items-center gap-1.5 text-[12px] text-success"><CircleCheck className="size-3.5" />Ready to build</p> : null}
      </Card>
    </div>
  );
};
