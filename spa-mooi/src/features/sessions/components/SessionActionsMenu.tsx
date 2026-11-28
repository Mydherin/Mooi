import { useState } from 'react';
import { Copy, FolderGit2, KeyRound, XCircle } from 'lucide-react';
import { DevelopmentEnvironmentDialog } from '@/features/development/components/DevelopmentEnvironmentDialog';
import { deployMenuSection } from '@/features/sessions/lib/deployMenuSection';
import type { DeployControl } from '@/features/sessions/types/DeployControl';
import type { Session } from '@/features/sessions/types/Session';
import { Menu } from '@/shared/components/overlays/menu/Menu';
import type { MenuSection } from '@/shared/components/overlays/menu/MenuSection';
import { useIsPhone } from '@/shared/hooks/useIsPhone';

interface SessionActionsMenuProps {
  session: Session;
  /** The preview deployment, when the project offers it; phones reach its actions here. */
  deploy: DeployControl | null;
  onClose: () => void;
  closeBusy: boolean;
}

const copy = (value: string) => void navigator.clipboard.writeText(value).catch(() => undefined);

/**
 * Secondary session actions behind one icon. Closing is destructive and rare, so it lives here
 * instead of competing with the branch name and the deploy control for header space.
 */
export const SessionActionsMenu = ({ session, deploy, onClose, closeBusy }: SessionActionsMenuProps) => {
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const phone = useIsPhone();
  const sections: MenuSection[] = [
    ...(deploy && phone ? [deployMenuSection(deploy)] : []),
    { id: 'session', items: [
      { id: 'branch', label: 'Copy branch name', icon: Copy, onSelect: () => copy(session.branch) },
      { id: 'path', label: 'Copy clone path', icon: FolderGit2, disabled: !session.workspacePath,
        onSelect: () => { if (session.workspacePath) copy(session.workspacePath); } },
      { id: 'environment', label: 'Environment variables', icon: KeyRound, onSelect: () => setEnvironmentOpen(true) },
    ] },
    { id: 'danger', items: [
      { id: 'close', label: closeBusy ? 'Closing…' : 'Close session', icon: XCircle, destructive: true, disabled: closeBusy, onSelect: onClose },
    ] },
  ];

  return <>
    <Menu label="Session actions" indicator={phone && Boolean(deploy?.failure && !deploy.active)} sections={sections} />
    {environmentOpen ? <DevelopmentEnvironmentDialog projectId={session.projectId} onClose={() => setEnvironmentOpen(false)} /> : null}
  </>;
};
