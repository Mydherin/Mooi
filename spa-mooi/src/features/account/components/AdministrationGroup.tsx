import { ShieldCheck } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { ListRow } from '@/shared/components/data-display/ListRow';

/** Administrators' way into the console; access is still verified by the server. */
export const AdministrationGroup = () => (
  <ListGroup title="Administration">
    <ListRow to={ROUTES.admin} title="Admin console" subtitle="Users, live sessions and agent defaults"
      leading={<span className="flex size-8 items-center justify-center rounded-control bg-brand-soft text-brand-strong"><ShieldCheck aria-hidden className="size-4.5" /></span>} />
  </ListGroup>
);
