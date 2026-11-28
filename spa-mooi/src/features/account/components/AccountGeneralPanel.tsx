import { AdministrationGroup } from '@/features/account/components/AdministrationGroup';
import { AppearanceGroup } from '@/features/account/components/AppearanceGroup';
import { ProfileSummary } from '@/features/account/components/ProfileSummary';
import { SignOutGroup } from '@/features/account/components/SignOutGroup';
import type { AuthPlayer } from '@/features/auth/types/AuthPlayer';

interface AccountGeneralPanelProps {
  player: AuthPlayer;
}

/** Profile, personal settings and signing out, as inset grouped lists. */
export const AccountGeneralPanel = ({ player }: AccountGeneralPanelProps) => (
  <div className="flex min-w-0 flex-col gap-6">
    <ProfileSummary player={player} />
    <AppearanceGroup />
    {player.role === 'admin' ? <AdministrationGroup /> : null}
    <SignOutGroup />
  </div>
);
