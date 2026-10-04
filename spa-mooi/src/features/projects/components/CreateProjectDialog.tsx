import { useEffect, useState, type FormEvent } from 'react';
import { ProjectKindField } from '@/features/projects/components/ProjectKindField';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Creates the repository on GitHub and adds it as a project whose kind the player chose up front. */
export const CreateProjectDialog = ({ open, onClose }: CreateProjectDialogProps) => {
  const { busy, actionError, create, clearActionError } = useProjects();
  const [name, setName] = useState('');
  const [isPrivate, setPrivate] = useState(true);
  const [webApplication, setWebApplication] = useState<boolean | null>(null);
  const valid = /^[A-Za-z0-9._-]{1,100}$/.test(name) && webApplication !== null;

  useEffect(() => {
    if (!open) return;
    setName('');
    setPrivate(true);
    setWebApplication(null);
    clearActionError();
  }, [clearActionError, open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || busy || webApplication === null) return;
    void create(name, isPrivate, { webApplication }).then((project) => {
      if (project) onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Create project" description="Create a new repository in your linked GitHub account."
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="brand" type="submit" form="create-project-form" disabled={!valid || busy}>
          {busy ? 'Creating…' : 'Create on GitHub'}
        </Button></>}>
      <form id="create-project-form" onSubmit={submit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-bold text-ink">
          Repository name
          <input autoFocus required maxLength={100} autoCapitalize="none" autoCorrect="off" spellCheck={false} pattern="[A-Za-z0-9._-]+" value={name}
            onChange={(event) => { setName(event.target.value); clearActionError(); }}
            placeholder="my-project"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink outline-none focus:border-brand" />
          <span className="text-xs font-normal text-ink-muted">Letters, numbers, dots, hyphens and underscores.</span>
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold text-ink">Visibility</legend>
          {([true, false] as const).map((privateOption) => (
            <label key={String(privateOption)} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink">
              <input type="radio" name="visibility" checked={isPrivate === privateOption}
                onChange={() => setPrivate(privateOption)} className="accent-brand" />
              <span><strong>{privateOption ? 'Private' : 'Public'}</strong>
                <span className="ml-2 text-ink-muted">{privateOption ? 'Only people you allow can see it.' : 'Anyone can see it.'}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <ProjectKindField value={webApplication} onChange={(value) => { setWebApplication(value); clearActionError(); }}
          hint="Deploy and live preview are only offered for web applications. You can change this later by editing the project." />
        {actionError ? <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">{actionError}</p> : null}
      </form>
    </Modal>
  );
};
