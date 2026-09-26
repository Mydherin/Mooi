import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AccountNoteCard } from '@/features/account/components/AccountNoteCard';
import { AccountRoleCard } from '@/features/account/components/AccountRoleCard';
import { AccountSessionCard } from '@/features/account/components/AccountSessionCard';
import { PreferencesCard } from '@/features/account/components/PreferencesCard';
import { ProfileCard } from '@/features/account/components/ProfileCard';
import { AgentConnectionsCard } from '@/features/agents/components/AgentConnectionsCard';
import { GithubConnectionCard } from '@/features/github/components/GithubConnectionCard';
import { Tabs } from '@/shared/components/Tabs';
import type { TabItem } from '@/shared/types/TabItem';
import { useAuthStore } from '@/stores/authStore';

const tabs: TabItem[] = [
  { id: 'profile', label: 'Profile & preferences' },
  { id: 'github', label: 'GitHub' },
  { id: 'agents', label: 'Agent accounts' },
];

export const AccountPage = () => {
  const player = useAuthStore((state) => state.player);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') === 'agents' ? 'agents' : 'profile');

  if (!player) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
      <h1 className="text-[32px] font-extrabold tracking-[-0.045em] text-ink sm:text-[38px]">
        Account
      </h1>

      <Tabs
        items={tabs}
        value={tab}
        onChange={setTab}
        ariaLabel="Account sections"
        className="mt-5 border-b border-line"
      />

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {tab === 'profile' ? (
            <>
              <ProfileCard player={player} />
              <PreferencesCard />
            </>
          ) : null}
          {tab === 'github' ? <GithubConnectionCard /> : null}
          {tab === 'agents' ? <AgentConnectionsCard /> : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <AccountSessionCard />
          <AccountRoleCard role={player.role} />
          <AccountNoteCard />
        </aside>
      </div>
    </div>
  );
};
