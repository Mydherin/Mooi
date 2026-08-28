import { Plus } from 'lucide-react';
import { SessionListItem } from '@/features/projects/components/SessionListItem';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';

interface SessionListProps {
  sessions: Session[];
}

export const SessionList = ({ sessions }: SessionListProps) => (
  <Card as="section" className="overflow-hidden">
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <h2 className="text-sm font-semibold tracking-tight text-ink">Sessions</h2>
      <Button variant="ghost" size="sm">
        <Plus className="size-4" />
        New session
      </Button>
    </div>

    <ul className="divide-y divide-line">
      {sessions.map((session) => (
        <SessionListItem key={session.id} session={session} />
      ))}
    </ul>
  </Card>
);
