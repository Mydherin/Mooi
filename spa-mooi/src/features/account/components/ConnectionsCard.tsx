import { connections } from '@/features/account/data/connections';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';

export const ConnectionsCard = () => (
  <Card className="p-6">
    <h2 className="text-sm font-semibold tracking-tight text-ink">Connections</h2>

    <ul className="mt-4 flex flex-col gap-4">
      {connections.map((connection) => (
        <li key={connection.id} className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-muted">
            <connection.icon className="size-4" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{connection.name}</span>
            <span className="block truncate text-xs text-ink-subtle">
              {connection.description}
            </span>
          </span>

          <Badge tone={connection.connected ? 'success' : 'neutral'}>
            {connection.connected ? 'Connected' : 'Not set'}
          </Badge>
        </li>
      ))}
    </ul>

    <Button variant="ghost" size="sm" className="mt-5 -ml-3.5">
      Manage connections
    </Button>
  </Card>
);
