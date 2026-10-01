import { updateDevelopmentEnvironment } from '@/features/development/api/developmentApi';
import { useDevelopmentEnvironment } from '@/features/development/hooks/useDevelopmentEnvironment';
import { PlatformEnvironmentDialog } from '@/features/platform/components/PlatformEnvironmentDialog';

interface DevelopmentEnvironmentDialogProps {
  projectId: string;
  onClose: () => void;
}

/** Manages the variables every session of the project shares; the agents read and save them too. */
export const DevelopmentEnvironmentDialog = ({ projectId, onClose }: DevelopmentEnvironmentDialogProps) => {
  const { variables, error } = useDevelopmentEnvironment(projectId);

  return <PlatformEnvironmentDialog prefix="MOOI_DEVELOPMENT_" variables={variables ?? []} loading={variables === null}
    loadError={error} emptyDescription="No development variables yet. Add one here or ask the agent in any session."
    description="Stored encrypted in the platform and shared by every session of this project, its previews and, inherited, its deployments and backups."
    save={(values) => updateDevelopmentEnvironment(projectId, values)} onClose={onClose} onSaved={onClose} />;
};
