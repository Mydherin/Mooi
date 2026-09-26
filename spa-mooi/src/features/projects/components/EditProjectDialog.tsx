import { useState } from 'react';
import { ProjectKindField } from '@/features/projects/components/ProjectKindField';
import { useProjectSettings } from '@/features/projects/hooks/useProjectSettings';
import type { Project } from '@/features/projects/types/Project';
import type { ProjectSettings } from '@/features/projects/types/ProjectSettings';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface EditProjectDialogProps {
  project: Project;
  onClose: () => void;
}

const settingsOf = (project: Project): ProjectSettings => ({ webApplication: project.webApplication });

/**
 * Every player-owned project setting in one form. Changes are a draft until saved, so a new field
 * joins `ProjectSettings` and this form without touching how saving works. Mounted only while open,
 * so each opening starts from the saved values with no stale error.
 */
export const EditProjectDialog = ({ project, onClose }: EditProjectDialogProps) => {
  const { saving, error, save } = useProjectSettings(project.id);
  const [draft, setDraft] = useState<ProjectSettings>(() => settingsOf(project));

  const dirty = draft.webApplication !== project.webApplication;

  const handleSave = () => {
    void save(draft).then((saved) => {
      if (saved) {
        onClose();
      }
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Edit project"
      description={`Settings Mooi keeps for ${project.fullName}. Repository details stay managed on GitHub.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <ProjectKindField
        value={draft.webApplication}
        onChange={(webApplication) => setDraft((current) => ({ ...current, webApplication }))}
        hint="Deploy and live preview are only offered for web applications. A deployment already running stays stoppable from its session."
      />
      {error ? (
        <p className="mt-5 rounded-xl border border-danger/40 bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Modal>
  );
};
