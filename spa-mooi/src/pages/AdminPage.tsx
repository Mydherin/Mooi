import { AdminUsersPanel } from '@/features/admin/components/AdminUsersPanel';
import { AdminAgentDefaults } from '@/features/agents/components/defaults/AdminAgentDefaults';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';
import { TabPanels } from '@/shared/components/navigation/TabPanels';
import { useTabParam } from '@/shared/components/navigation/useTabParam';

const TAB_IDS = ['users', 'agents'] as const;
type AdminTab = (typeof TAB_IDS)[number];

/**
 * The platform console. The active section lives in `?tab=` so a reload lands back on it; each
 * section mounts only while shown, so the live user directory streams only while it is open.
 */
export const AdminPage = () => {
  const [tab, setTab] = useTabParam(TAB_IDS, 'users');
  const change = (id: string) => setTab(id as AdminTab);

  return (
    <Page width="wide">
      <PageHeader title="Admin" eyebrow="Platform" subtitle="Who uses the platform right now, and its defaults.">
        <SegmentedControl ariaLabel="Admin sections" value={tab} onChange={change} className="w-full sm:w-auto"
          items={[{ id: 'users', label: 'Users' }, { id: 'agents', label: 'Agents' }]} />
      </PageHeader>
      <TabPanels ids={[...TAB_IDS]} value={tab} onChange={change} idPrefix="admin" swipeable>
        {(id) => (id === 'agents' ? <AdminAgentDefaults /> : <AdminUsersPanel />)}
      </TabPanels>
    </Page>
  );
};
