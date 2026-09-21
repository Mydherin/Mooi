import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { Project } from '@/features/projects/types/Project';
import type { CreateSessionRequest } from '@/features/sessions/types/CreateSessionRequest';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { SegmentedControl } from '@/shared/components/SegmentedControl';

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
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');

  const wasOpenRef = useRef(false);

  /**
   * Only the closed-to-open transition seeds branch/title: a `connections` refresh (e.g. the
   * account page linking a provider in another tab) must not wipe what the user is typing.
   */
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setBranch(proposeBranchName(project.name));
      setTitle('');
    }
    wasOpenRef.current = open;
  }, [open, project.name]);

  useEffect(() => {
    if (!open) return;
    setProvider((current) => (current && connections.some((connection) => connection.provider === current)
      ? current
      : connections[0]?.provider ?? ''));
  }, [open, connections]);

  const canSubmit = connections.length > 0 && branch.trim().length > 0 && provider.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    void onCreate({
      projectId: project.id,
      provider,
      branch: branch.trim(),
      title: title.trim().length > 0 ? title.trim() : undefined,
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
            <span className="font-medium">Link an agent provider first.</span>{' '}
            <span className="text-ink-muted">A session needs one to run.</span>
          </p>
          <Link
            to={ROUTES.account}
            onClick={onClose}
            className="mt-2 inline-block font-medium text-brand underline-offset-4 hover:underline"
          >
            Go to account settings
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-muted">Agent provider</span>
            <SegmentedControl
              items={connections.map((connection) => ({ id: connection.provider, label: connection.label }))}
              value={provider}
              onChange={setProvider}
            />
          </label>

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

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-muted">Title (optional)</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What is this session for?"
              autoComplete="off"
              aria-label="Session title"
              className="h-12 w-full min-w-0 rounded-[10px] border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle transition focus:border-brand/50 focus:outline-none"
            />
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
