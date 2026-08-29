import { ConnectionsCard } from '@/features/account/components/ConnectionsCard';
import { PreferencesCard } from '@/features/account/components/PreferencesCard';
import { ProfileCard } from '@/features/account/components/ProfileCard';
import { SecurityCard } from '@/features/account/components/SecurityCard';
import { GithubConnectionCard } from '@/features/github/components/GithubConnectionCard';
import { useAuthStore } from '@/stores/authStore';

export const AccountPage = () => {
  const player = useAuthStore((state) => state.player);

  if (!player) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Account</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Your profile, connections and preferences.
      </p>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-3">
        <ProfileCard player={player} />
        <GithubConnectionCard />
        <ConnectionsCard />
        <PreferencesCard />
        <SecurityCard />
      </div>
    </div>
  );
};
