import { useEffect, type ReactNode } from 'react';
import type { ActionItem } from '@/shared/components/actions/ActionItem';
import { ResponsiveActions } from '@/shared/components/actions/ResponsiveActions';
import { StatusDot } from '@/shared/components/data-display/StatusDot';
import { TruncatedText } from '@/shared/components/data-display/TruncatedText';
import { usePageChrome } from '@/shared/components/layout/PageChrome';
import { BackButton } from '@/shared/components/navigation/BackButton';
import { Tabs } from '@/shared/components/navigation/Tabs';
import type { BackLink } from '@/shared/types/BackLink';
import type { TabItem } from '@/shared/types/TabItem';
import type { Tone } from '@/shared/types/Tone';

interface OperationHeaderProps {
  back: BackLink;
  title: string;
  status: { label: string; tone: Tone; pulse: boolean };
  /** Extra facts beside the status (service health, running release); wraps under it on phones. */
  meta?: ReactNode;
  actions: ActionItem[];
  actionsLabel: string;
  tabs: TabItem[];
  tab: string;
  onTabChange: (id: string) => void;
  tabsLabel: string;
  idPrefix: string;
}

/**
 * The fixed top of a project's production or backup tool screen: back, the project with its one
 * status line, the actions (only the primary stays inline on phones) and the view strip, shown only
 * once there is more than one view. The strip steps aside while the chat composer is typed into.
 */
export const OperationHeader = ({ back, title, status, meta, actions, actionsLabel, tabs, tab, onTabChange, tabsLabel, idPrefix }: OperationHeaderProps) => {
  const { setTitle } = usePageChrome();

  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [setTitle, title]);

  return (
    <header className="shrink-0 border-b border-line bg-frosted">
      <div className="flex min-h-14 min-w-0 items-center gap-2 px-gutter py-1.5 lg:py-3">
        <BackButton back={back} compact className="lg:hidden" />
        <div className="min-w-0 flex-1">
          <h1 className="min-w-0 text-headline text-ink lg:text-title"><TruncatedText text={title} /></h1>
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-ink-muted">
            <span className="inline-flex items-center gap-1.5 font-medium"><StatusDot tone={status.tone} pulse={status.pulse} />{status.label}</span>
            {meta}
          </p>
        </div>
        <ResponsiveActions label={actionsLabel} actions={actions} />
      </div>
      {tabs.length > 1 ? <div className="min-w-0 px-gutter composing:max-lg:hidden">
        <Tabs items={tabs} value={tab} onChange={onTabChange} ariaLabel={tabsLabel} idPrefix={idPrefix} />
      </div> : null}
    </header>
  );
};
