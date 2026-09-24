import { SquareTerminal } from 'lucide-react';

export const DeployLogsButton = ({ open, active, onClick }: { open: boolean; active: boolean; onClick: () => void }) => (
  <button type="button" aria-label="Deployment logs" title="Deployment logs" aria-expanded={open}
    aria-controls="deployment-logs-drawer" onClick={onClick}
    className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-r-[10px] border border-l-0 border-line bg-surface text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
  >
    <SquareTerminal className="size-4.5" />
    {active ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> : null}
  </button>
);
