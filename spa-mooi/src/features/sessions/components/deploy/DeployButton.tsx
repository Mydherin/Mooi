import { LoaderCircle, Rocket, Settings2, Square, SquareTerminal } from 'lucide-react';
import { HeaderActionHint } from '@/features/sessions/components/HeaderActionHint';
import { HEADER_ACTION_CLASS } from '@/features/sessions/lib/headerActionClass';
import type { DeployControl } from '@/features/sessions/types/DeployControl';
import { Button } from '@/shared/components/Button';
import { cn } from '@/shared/utils/cn';
import { DeployGroupButton } from './DeployGroupButton';
import { DeploymentSetupDialog } from './DeploymentSetupDialog';

/**
 * The header deploy group: the main action plus setup and logs segments. Phones keep only the main
 * button, and only while a deployment is active; the rest lives in the session actions menu
 * (`DeployMenuActions`).
 */
export const DeployButton = ({ control }: { control: DeployControl }) => {
  const { label, hint, failure, blocked, canStop, starting, loading, active, withLogs, withSetup } = control;
  const segmented = withLogs || withSetup;

  return (
    <div className={cn('min-w-0 shrink-0 items-stretch', active ? 'inline-flex' : 'hidden sm:inline-flex')}>
      <HeaderActionHint hint={hint}>
        <Button variant={canStop ? 'secondary' : 'brand'} size="sm" disabled={blocked}
          className={cn(HEADER_ACTION_CLASS, segmented && 'sm:rounded-r-none')}
          ariaLabel={starting ? 'Cancel deployment' : `${label} deployment`}
          onClick={control.run}>
          {loading ? <LoaderCircle className="size-4 animate-spin" />
            : canStop ? <Square className="size-4" /> : <Rocket className="size-4" />}
          <span className="hidden sm:inline">{label}</span>
          {failure ? <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-danger-dot" /> : null}
        </Button>
      </HeaderActionHint>
      {withSetup ? <DeployGroupButton icon={Settings2} label="Change deployment setup" last={!withLogs}
        disabled={control.setupBlocked} onClick={control.openSetup} /> : null}
      {withLogs ? <DeployGroupButton icon={SquareTerminal} label="Deployment logs" last active={starting}
        expanded={control.logOpen} controls="deployment-logs-drawer" onClick={control.toggleLogs} /> : null}
      {control.setupOpen ? <DeploymentSetupDialog busy={control.busy} error={control.error}
        onClose={control.closeSetup} onSubmit={control.submitSetup} /> : null}
    </div>
  );
};
