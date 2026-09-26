import { useEffect, useMemo, useState } from 'react';
import { useGithubConnection } from '@/features/github/hooks/useGithubConnection';
import type { GithubRepository } from '@/features/github/types/GithubRepository';
import { ProjectKindStep } from '@/features/projects/components/ProjectKindStep';
import { RepositoryPicker } from '@/features/projects/components/RepositoryPicker';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { useReachableRepositories } from '@/features/projects/hooks/useReachableRepositories';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface AddProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The import flow, in two steps inside one dialog: pick a repository the linked GitHub account can
 * reach, then say whether it is a web application. Nothing is persisted until the second step is
 * confirmed, and going back keeps the list and the search.
 */
export const AddProjectDialog = ({ open, onClose }: AddProjectDialogProps) => {
  const { projects, busy, actionError, add, clearActionError } = useProjects();
  const { manageAccess } = useGithubConnection();
  const { repositories, installations, loading, failure, load } = useReachableRepositories(open);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<GithubRepository | null>(null);
  const [webApplication, setWebApplication] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery('');
    setSelected(null);
    setWebApplication(null);
    clearActionError();
  }, [clearActionError, open]);

  const addedRepoIds = useMemo(
    () => new Set(projects.map((project) => project.githubRepoId)),
    [projects],
  );

  const handleSelect = (repository: GithubRepository) => {
    clearActionError();
    setWebApplication(null);
    setSelected(repository);
  };

  const handleBack = () => {
    clearActionError();
    setSelected(null);
  };

  const handleConfirm = () => {
    if (!selected || webApplication === null) {
      return;
    }

    void add(selected.fullName, { webApplication }).then((project) => {
      if (project) {
        onClose();
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={selected ? 'Set up project' : 'Add repository'}
      description={
        selected
          ? 'Step 2 of 2 · Tell Mooi what kind of project this is.'
          : 'Step 1 of 2 · Only repositories your GitHub authorisation can reach, read now rather than from a saved copy.'
      }
      footer={
        selected ? (
          <>
            <Button variant="secondary" onClick={handleBack} disabled={busy}>
              Back
            </Button>
            <Button variant="brand" onClick={handleConfirm} disabled={busy || webApplication === null}>
              {busy ? 'Adding…' : 'Add project'}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {selected ? (
        <>
          <ProjectKindStep
            repository={selected}
            webApplication={webApplication}
            onChange={setWebApplication}
            onBack={handleBack}
          />
          {actionError ? (
            <p className="mt-5 rounded-xl border border-danger/40 bg-danger-soft px-4 py-2.5 text-sm text-danger">
              {actionError}
            </p>
          ) : null}
        </>
      ) : (
        <RepositoryPicker
          repositories={repositories}
          installations={installations}
          loading={loading}
          failure={failure}
          addedRepoIds={addedRepoIds}
          query={query}
          onQueryChange={setQuery}
          onReload={load}
          onManageAccess={manageAccess}
          onSelect={handleSelect}
        />
      )}
    </Modal>
  );
};
