import { Copy, FolderGit2, XCircle } from 'lucide-react';
import type { Session } from '@/features/sessions/types/Session';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { MenuAction } from '@/shared/components/MenuAction';

interface SessionActionsMenuProps {
  session: Session;
  onClose: () => void;
  closeBusy: boolean;
}

/**
 * Secondary session actions behind one icon. Closing is destructive and rare, so it lives here
 * instead of competing with the branch name and the deploy control for header space.
 */
export const SessionActionsMenu = ({ session, onClose, closeBusy }: SessionActionsMenuProps) => (
  <ActionsMenu label="Session actions">
    {(dismiss) => {
      const copy = (value: string) => {
        void navigator.clipboard.writeText(value).catch(() => undefined);
        dismiss();
      };

      return <>
        <MenuAction icon={Copy} label="Copy branch name" onClick={() => copy(session.branch)} />
        <MenuAction
          icon={FolderGit2}
          label="Copy clone path"
          disabled={!session.workspacePath}
          onClick={() => session.workspacePath && copy(session.workspacePath)}
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
);
