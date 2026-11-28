import { AccountGeneralPanel } from '@/features/account/components/AccountGeneralPanel';
import { AgentAccountsPanel } from '@/features/agents/components/accounts/AgentAccountsPanel';
import { GithubConnectionPanel } from '@/features/github/components/GithubConnectionPanel';
import { RecipeMarketplacesPanel } from '@/features/recipes/components/RecipeMarketplacesPanel';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PageSection } from '@/shared/components/layout/PageSection';
import { TabPanels } from '@/shared/components/navigation/TabPanels';
import { Tabs } from '@/shared/components/navigation/Tabs';
import { useTabParam } from '@/shared/components/navigation/useTabParam';
import type { TabItem } from '@/shared/types/TabItem';
import { useAuthStore } from '@/stores/authStore';

const TAB_IDS = ['general', 'github', 'agents', 'recipes'] as const;

const tabs: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'github', label: 'GitHub' },
  { id: 'agents', label: 'Agents' },
  { id: 'recipes', label: 'Recipes' },
];

/** Profile, personal settings and every linked account, one swipeable tab each (`?tab=` deep links). */
export const AccountPage = () => {
  const player = useAuthStore((state) => state.player);
  const [tab, setTab] = useTabParam(TAB_IDS, 'general');

  if (!player) return null;

  return (
    <Page width="narrow">
      <PageHeader title="Account" eyebrow="Settings">
        <Tabs items={tabs} value={tab} onChange={(id) => setTab(id as typeof tab)} ariaLabel="Account sections" idPrefix="account" />
      </PageHeader>
      <TabPanels ids={[...TAB_IDS]} value={tab} onChange={(id) => setTab(id as typeof tab)} idPrefix="account" swipeable>
        {(id) => (
          <PageSection>
            {id === 'general' ? <AccountGeneralPanel player={player} />
              : id === 'github' ? <GithubConnectionPanel />
                : id === 'agents' ? <AgentAccountsPanel />
                  : <RecipeMarketplacesPanel />}
          </PageSection>
        )}
      </TabPanels>
    </Page>
  );
};
