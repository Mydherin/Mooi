import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import type { PlayerRole } from '@/features/auth/types/PlayerRole';

interface AccountRoleCardProps {
  role: PlayerRole;
}

export const AccountRoleCard = ({ role }: AccountRoleCardProps) => (
  <section className="rounded-[14px] bg-contrast p-5 text-contrast-ink">
    <p className="text-[11px] font-extrabold tracking-[0.09em] text-contrast-ink/55 uppercase">
      Your role
    </p>
    <p className="mt-1.5 text-[22px] font-extrabold tracking-[-0.03em] capitalize">{role}</p>
    <p className="mt-2.5 text-[12px] leading-relaxed text-contrast-ink/70">
      Your role was decided when your account was created, from a list the operators maintain. Adding
      an address to that list later does not promote an account that already exists.
    </p>

    {role === 'admin' ? (
      <Link
        to={ROUTES.admin}
        className="mt-4 flex min-h-11 items-center justify-between gap-2 rounded-[10px] bg-contrast-ink px-4 text-[13px] font-bold text-contrast transition hover:bg-contrast-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Go to Admin
        <ChevronRight className="size-4" />
      </Link>
    ) : null}

    <p className="mt-3 text-[11px] leading-relaxed text-contrast-ink/50">
      Access is decided and verified by the server. The interface only reflects what the server allows.
    </p>
  </section>
);
