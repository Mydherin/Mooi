import { Link } from 'react-router-dom';
import { DatabaseBackup, KeyRound, MessagesSquare, Rocket, Sparkles, Terminal } from 'lucide-react';
import { deploymentPath } from '@/app/paths';
import { BACKUP_STAGE_VIEWS } from '@/features/backups/lib/backupStageView';
import type { BackupStage } from '@/features/backups/types/BackupStage';
import { OperationStatusCard } from '@/features/production/components/operation/OperationStatusCard';
import { OperationSteps, type OperationStep } from '@/features/production/components/operation/OperationSteps';
import { Button } from '@/shared/components/actions/Button';
import { buttonStyles } from '@/shared/styles/buttonStyles';

interface BackupHeroProps {
  projectId: string;
  stage: BackupStage;
  hasChat: boolean;
  missingVariables: number;
  deployedRelease: string | null;
  busy: boolean;
  onSetup: () => void;
  onBackup: () => void;
  onOpenChat: () => void;
  onOpenConsole: () => void;
  onFix: () => void;
  onEnvironment: () => void;
}

const STEPS: OperationStep[] = [
  { title: 'Describe it', description: 'Pick an agent and explain what must be protected and where backups are kept.' },
  { title: 'Prepare and prove it', description: 'The agent writes the scripts, runs a real backup and restores it into a disposable copy of production.' },
  { title: 'Back up and restore', description: 'Create backups of the running release, restore any of them and clean up old ones.' },
];

/** Where the project's backups stand and the single next step; secondary actions live in the header. */
export const BackupHero = ({ projectId, stage, hasChat, missingVariables, deployedRelease, busy, onSetup, onBackup, onOpenChat,
  onOpenConsole, onFix, onEnvironment }: BackupHeroProps) => {
  const view = BACKUP_STAGE_VIEWS[stage];
  const operational = stage === 'ready' || stage === 'protected' || stage === 'failed';
  const blocked = missingVariables > 0 && operational;

  return (
    <OperationStatusCard key={stage} icon={view.icon} tone={view.tone} busy={stage === 'running'} title={view.title}
      description={blocked ? `${missingVariables} required environment ${missingVariables === 1 ? 'variable is' : 'variables are'} missing. Set ${missingVariables === 1 ? 'it' : 'them'} before backing up.`
        : operational && !deployedRelease ? 'Nothing runs in production right now. Deploy a release before creating backups.' : view.description}
      actions={<>
        {stage === 'undeployed' ? <Link to={deploymentPath(projectId)} className={buttonStyles('brand', 'lg')}><Rocket aria-hidden className="size-4.5" />Go to deployment</Link> : null}
        {stage === 'unconfigured' ? <Button variant="brand" size="lg" icon={DatabaseBackup} onClick={onSetup}>Set up backups</Button> : null}
        {stage === 'preparing' ? <Button variant="brand" size="lg" icon={MessagesSquare} onClick={onOpenChat}>Continue in chat</Button> : null}
        {stage === 'running' ? <Button variant="brand" size="lg" icon={Terminal} onClick={onOpenConsole}>Watch the console</Button> : null}
        {stage === 'failed' ? <Button variant="secondary" size="lg" icon={Sparkles} onClick={hasChat ? onOpenChat : onFix}>Fix with agent</Button> : null}
        {blocked ? <Button variant="brand" size="lg" icon={KeyRound} onClick={onEnvironment}>Set variables</Button>
          : operational ? <Button variant="brand" size="lg" icon={DatabaseBackup} onClick={onBackup} disabled={busy || !deployedRelease}>
            {stage === 'failed' ? 'Back up again' : 'Create backup'}</Button> : null}
      </>}>
      {stage === 'unconfigured' || stage === 'preparing' ? <OperationSteps steps={STEPS} current={stage === 'unconfigured' ? 0 : 1} /> : null}
    </OperationStatusCard>
  );
};
