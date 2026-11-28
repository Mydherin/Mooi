import { useState } from 'react';
import { Copy, FolderGit2, GitBranch, Info, KeyRound, XCircle } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { DevelopmentEnvironmentDialog } from '@/features/development/components/DevelopmentEnvironmentDialog';
import { SessionLiveStatus } from '@/features/sessions/components/SessionLiveStatus';
import { useLinkedSessions } from '@/features/sessions/hooks/useLinkedSessions';
import { deployMenuSection } from '@/features/sessions/lib/deployMenuSection';
import type { DeployControl } from '@/features/sessions/types/DeployControl';
import type { Session } from '@/features/sessions/types/Session';
import { toast } from '@/shared/components/feedback/toast/toast';
import { ConfirmDialog } from '@/shared/components/overlays/confirm/ConfirmDialog';
import { Menu } from '@/shared/components/overlays/menu/Menu';
import type { MenuItem } from '@/shared/components/overlays/menu/MenuItem';
import type { MenuSection } from '@/shared/components/overlays/menu/MenuSection';
import { useIsPhone } from '@/shared/hooks/useIsPhone';

interface SessionActionsMenuProps {
  session: Session;
  /** The preview deployment, when the project offers it; phones reach its actions here. */
  deploy: DeployControl | null;
  onDetails: () => void;
  /** Resolves true once the session is closed (the page then leaves). */
  onClose: () => Promise<boolean>;
  closeBusy: boolean;
  closeError: string | null;
}

const copy = (value: string, what: string) => void navigator.clipboard.writeText(value)
  .then(() => toast({ title: `${what} copied`, tone: 'success' }))
  .catch(() => toast({ title: `Could not copy the ${what.toLowerCase()}`, tone: 'danger' }));

const linkedItem = (linked: Session): MenuItem => ({
  id: `linked-${linked.id}`,
  label: linked.title || linked.branch,
  description: linked.title ? linked.branch : undefined,
  icon: GitBranch,
  to: sessionPath(linked.projectId, linked.id),
  trailing: <SessionLiveStatus session={linked} />,
});

/**
 * Every secondary session action behind one button. On phones it also carries the preview controls
 * and the linked sessions, which have their own header controls from `sm`. Closing asks first.
 */
export const SessionActionsMenu = ({ session, deploy, onDetails, onClose, closeBusy, closeError }: SessionActionsMenuProps) => {
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const phone = useIsPhone();
  const { origin, opened } = useLinkedSessions(session);
  const linked = [...(origin ? [origin] : []), ...opened];

  const sections: MenuSection[] = [
    ...(deploy && phone ? [deployMenuSection(deploy)] : []),
    ...(phone && linked.length > 0 ? [{ id: 'linked', title: 'Linked sessions', items: linked.map(linkedItem) }] : []),
    { id: 'session', items: [
      { id: 'details', label: 'Session details', icon: Info, onSelect: onDetails },
      { id: 'branch', label: 'Copy branch name', icon: Copy, onSelect: () => copy(session.branch, 'Branch name') },
      { id: 'path', label: 'Copy clone path', icon: FolderGit2, disabled: !session.workspacePath,
        onSelect: () => { if (session.workspacePath) copy(session.workspacePath, 'Clone path'); } },
      { id: 'environment', label: 'Environment variables', icon: KeyRound, onSelect: () => setEnvironmentOpen(true) },
    ] },
    { id: 'danger', items: [
      { id: 'close', label: 'Close session', icon: XCircle, destructive: true, disabled: closeBusy || session.status === 'closed',
        onSelect: () => setConfirmClose(true) },
    ] },
  ];

  const confirm = () => void onClose().then((closed) => { if (!closed) return; setConfirmClose(false); });

  return <>
    <Menu label="Session actions" width="md" indicator={phone && Boolean(deploy?.failure && !deploy.active)} sections={sections} />
    {environmentOpen ? <DevelopmentEnvironmentDialog projectId={session.projectId} onClose={() => setEnvironmentOpen(false)} /> : null}
    <ConfirmDialog open={confirmClose} onClose={() => setConfirmClose(false)} onConfirm={confirm} tone="danger"
      title="Close this session?" confirmLabel="Close session" busy={closeBusy} error={confirmClose ? closeError : null}
      description={<>The agent stops and the clone of <span className="font-mono [overflow-wrap:anywhere]">{session.branch}</span> is removed from the server. Merge first to keep its changes.</>} />
  </>;
};
