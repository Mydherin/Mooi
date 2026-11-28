import { Rocket, Settings2, SquareTerminal } from 'lucide-react';
import type { MenuSection } from '@/shared/components/overlays/menu/MenuSection';
import type { DeployControl } from '@/features/sessions/types/DeployControl';

/**
 * The deploy group as menu items, for phones only: the header keeps the deploy button just while a
 * deployment is active, so starting one, its setup and its logs live in the session actions menu.
 */
export const deployMenuSection = (control: DeployControl): MenuSection => ({
  id: 'preview',
  title: 'Preview',
  note: control.failure ? <span role="status" className="line-clamp-3 rounded-chip bg-danger-soft px-2.5 py-1.5 text-danger">{control.failure}</span> : undefined,
  items: [
    { id: 'deploy', label: control.label === 'Retry' ? 'Retry deployment' : 'Deploy preview', icon: Rocket, hidden: control.active,
      disabled: control.blocked, onSelect: control.run },
    { id: 'setup', label: 'Change deployment setup', icon: Settings2, hidden: !control.withSetup, disabled: control.setupBlocked, onSelect: control.openSetup },
    { id: 'logs', label: control.logOpen ? 'Hide deployment logs' : 'Show deployment logs', icon: SquareTerminal, hidden: !control.withLogs,
      onSelect: control.toggleLogs },
  ],
});
