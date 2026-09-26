import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
import { fetchSessionProvider } from '@/features/sessions/api/sessionsApi';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';
import { SessionModelFields } from '@/features/sessions/components/SessionModelFields';
import { ROUTES } from '@/app/routes';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import { AgentAccountSelect } from '@/features/agents/components/AgentAccountSelect';
import type { Project } from '@/features/projects/types/Project';
import type { CreateSessionRequest } from '@/features/sessions/types/CreateSessionRequest';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface NewSessionDialogProps {
  open: boolean;
  project: Project;
  connections: AgentConnection[];
  busy: boolean;
  actionError: string | null;
  onClose: () => void;
  onCreate: (request: CreateSessionRequest) => Promise<boolean>;
}

const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');

  return slug.length > 0 ? slug : 'session';
};

const MAX_BRANCH_LENGTH = 120;
const BRANCH_PREFIX = 'feat/';

const randomSuffix = (): string => Math.random().toString(36).slice(2, 8);

const defaultEffortFor = (provider: SessionProvider | undefined, model: string): string => {
  const entry = provider?.models.find((candidate) => candidate.id === model);
  if (!entry?.efforts.length) return '';
  if (model === provider?.defaultModel && provider.defaultEffort && entry.efforts.includes(provider.defaultEffort)) return provider.defaultEffort;
  if (entry.defaultEffort && entry.efforts.includes(entry.defaultEffort)) return entry.defaultEffort;
  return entry.efforts[0];
};

/**
 * Suggest a fresh branch per opening; users can also reuse an existing remote branch.
 * Each session has its own clone, so matching branch names can run independently.
 */
const proposeBranchName = (projectName: string): string => {
  const suffix = randomSuffix();
  const slugBudget = MAX_BRANCH_LENGTH - BRANCH_PREFIX.length - suffix.length - 1;
  const slug = slugify(projectName).slice(0, Math.max(slugBudget, 1));

  return `${BRANCH_PREFIX}${slug}-${suffix}`;
};

/**
 * Only linked providers are offered: an unlinked one cannot start a session,
 * so the picker never lists a choice the request would immediately reject.
 */
export const NewSessionDialog = ({
  open,
  project,
  connections,
  busy,
  actionError,
  onClose,
  onCreate,
}: NewSessionDialogProps) => {
  const [branch, setBranch] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [catalog, setCatalog] = useState<{ connectionId: string; provider: SessionProvider } | null>(null);
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const selectedConnection = connections.find((entry) => entry.id === connectionId);
  const provider = selectedConnection?.provider ?? '';
  const selectedProvider = catalog?.connectionId === connectionId && catalog.provider.id === provider
    ? catalog.provider : undefined;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCatalog(null);
    setCatalogError(null);
    if (!provider) return;
    void fetchSessionProvider(provider, connectionId).then((entry) => {
      if (!cancelled) setCatalog({ connectionId, provider: entry });
    }).catch((failure: Error) => {
      if (!cancelled) setCatalogError(failure.message);
    });
    return () => { cancelled = true; };
  }, [open, connectionId, provider]);

  useEffect(() => {
    const defaultModel = selectedProvider?.defaultModel ?? '';
    setModel(defaultModel);
    setEffort(defaultEffortFor(selectedProvider, defaultModel));
  }, [selectedProvider]);

  const wasOpenRef = useRef(false);

  /**
   * Only the closed-to-open transition seeds the branch: a `connections` refresh (e.g. the
   * account page linking a provider in another tab) must not wipe what the user is typing.
   */
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setBranch(proposeBranchName(project.name));
    }
    wasOpenRef.current = open;
  }, [open, project.name]);

  useEffect(() => {
    if (!open) return;
    setConnectionId((current) => (current && connections.some((connection) => connection.id === current)
      ? current : connections[0]?.id ?? ''));
  }, [open, connections]);

  const canSubmit = connections.length > 0 && branch.trim().length > 0 && provider.length > 0 && connectionId.length > 0
    && Boolean(selectedProvider?.models.some((entry) => entry.id === model)) && !selectedProvider?.unavailable;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    void onCreate({
      projectId: project.id,
      provider,
      connectionId,
      model,
      effort: effort || null,
      branch: branch.trim(),
    }).then((succeeded) => {
      if (succeeded) {
        onClose();
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New session"
      description={`Start a live agent session on ${project.fullName}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSubmit} disabled={busy || !canSubmit}>
            {busy ? 'Creating…' : 'Create session'}
          </Button>
        </>
      }
    >
      {connections.length === 0 ? (
        <div className="rounded-[10px] border border-warning/30 bg-warning-soft px-4 py-3.5 text-sm leading-relaxed text-ink">
          <p>
            <span className="font-medium">Add an agent account first.</span>{' '}
            <span className="text-ink-muted">A session needs one to run.</span>
          </p>
          <Link
            to={`${ROUTES.account}?tab=agents`}
            onClick={onClose}
            className="mt-2 inline-block font-medium text-brand underline-offset-4 hover:underline"
          >
            Go to account settings
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-muted">Agent account</span>
            <AgentAccountSelect connections={connections} value={connectionId} onChange={setConnectionId} />
          </label>

          <SessionModelFields provider={selectedProvider} model={model} effort={effort}
            onModelChange={(value) => {
              setModel(value);
              setEffort(defaultEffortFor(selectedProvider, value));
            }} onEffortChange={setEffort} />
          {selectedProvider && !selectedProvider.unavailable && !selectedProvider.defaultModel && selectedProvider.models.length > 0 && !model &&
            <p role="status" className="rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-ink">
              The configured default model is unavailable. Select a model to continue.
            </p>}
          {catalogError ? <p role="alert" className="text-sm text-danger">{catalogError}</p> :
            !selectedProvider ? <p role="status" className="text-xs text-ink-muted">Loading models…</p> : null}

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-muted">Branch</span>
            <span className="flex h-12 w-full items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-3 transition focus-within:border-brand/50">
              <GitBranch className="size-4 shrink-0 text-ink-subtle" />
              <input
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                placeholder="feat/my-change"
                autoComplete="off"
                aria-label="Branch name"
                maxLength={MAX_BRANCH_LENGTH}
                className="h-full w-full min-w-0 bg-transparent font-mono text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
              />
            </span>
            <span className="text-xs text-ink-subtle">
              Created from {project.defaultBranch ?? 'the default branch'}. Reusing this branch replaces its previous live session safely; the remote branch is never deleted.
            </span>
          </label>
        </div>
      )}

      {actionError ? (
        <p className="mt-4 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {actionError}
        </p>
      ) : null}
    </Modal>
  );
};
