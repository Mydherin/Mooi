import { useState } from 'react';
import { Copy, FolderGit2, KeyRound, XCircle } from 'lucide-react';
import { DevelopmentEnvironmentDialog } from '@/features/development/components/DevelopmentEnvironmentDialog';
import { DeployMenuActions } from '@/features/sessions/components/deploy/DeployMenuActions';
import type { DeployControl } from '@/features/sessions/types/DeployControl';
import type { Session } from '@/features/sessions/types/Session';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { MenuAction } from '@/shared/components/MenuAction';

interface SessionActionsMenuProps {
  session: Session;
  /** The preview deployment, when the project offers it; phones reach its actions here. */
  deploy: DeployControl | null;
  onClose: () => void;
  closeBusy: boolean;
}

/**
 * Secondary session actions behind one icon. Closing is destructive and rare, so it lives here
 * instead of competing with the branch name and the deploy control for header space.
 */
export const SessionActionsMenu = ({ session, deploy, onClose, closeBusy }: SessionActionsMenuProps) => {
  const [environmentOpen, setEnvironmentOpen] = useState(false);

  return <>
    <ActionsMenu label="Session actions" indicator={Boolean(deploy?.failure && !deploy.active)} indicatorClassName="sm:hidden">
      {(dismiss) => {
        const copy = (value: string) => {
          void navigator.clipboard.writeText(value).catch(() => undefined);
          dismiss();
        };

        return <>
          {deploy ? <DeployMenuActions control={deploy} dismiss={dismiss} /> : null}
          <MenuAction icon={Copy} label="Copy branch name" onClick={() => copy(session.branch)} />
          <MenuAction
            icon={FolderGit2}
            label="Copy clone path"
            disabled={!session.workspacePath}
            onClick={() => session.workspacePath && copy(session.workspacePath)}
          />
          <MenuAction
            icon={KeyRound}
            label="Environment variables"
            onClick={() => {
              dismiss();
              setEnvironmentOpen(true);
            }}
          />
          <div className="my-1 h-px bg-line" />
          <MenuAction
            icon={XCircle}
            label={closeBusy ? 'Closing…' : 'Close session'}
            tone="danger"
            disabled={closeBusy}
            onClick={() => {
              dismiss();
              onClose();
            }}
          />
        </>;
      }}
    </ActionsMenu>
    {environmentOpen ? <DevelopmentEnvironmentDialog projectId={session.projectId} onClose={() => setEnvironmentOpen(false)} /> : null}
  </>;
};
