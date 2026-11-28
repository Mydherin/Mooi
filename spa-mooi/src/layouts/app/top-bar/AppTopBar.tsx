import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentSection } from '@/layouts/app/navigation/useCurrentSection';
import { ThemeToggle } from '@/shared/components/actions/ThemeToggle';
import { useBackLink } from '@/shared/hooks/useBackLink';
import { usePageTitleStore } from '@/stores/pageTitleStore';

/**
 * The desktop bar above every screen: breadcrumbs (section, where the screen was opened from, the
 * screen's own title) and the theme toggle. Phones have no global bar: each screen's `PageHeader`
 * is its bar, and navigation lives in the tab bar.
 */
export const AppTopBar = () => {
  const section = useCurrentSection();
  const title = usePageTitleStore((state) => state.title);
  const back = useBackLink({ to: section?.to ?? '', label: section?.label ?? '' });
  const SectionIcon = section?.icon;
  const middle = back.to && back.to !== section?.to ? back : null;
  const current = title && title !== section?.label ? title : null;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-canvas px-5">
      <nav aria-label="Breadcrumbs" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ink-muted">
          {section && SectionIcon ? (
            <li className="flex min-w-0 shrink-0 items-center">
              <Link to={section.to} aria-current={current || middle ? undefined : 'page'}
                className="flex items-center gap-2 rounded-chip px-1 py-0.5 transition-colors hover:text-ink">
                <SectionIcon aria-hidden className="size-4 shrink-0 text-ink-subtle" />
                <span className={current || middle ? undefined : 'text-ink'}>{section.label}</span>
              </Link>
            </li>
          ) : null}
          {middle ? (
            <li className="flex min-w-0 items-center gap-1.5">
              <ChevronRight aria-hidden className="size-3.5 shrink-0 text-line-strong" />
              <Link to={middle.to} className="truncate rounded-chip px-1 py-0.5 transition-colors hover:text-ink">{middle.label}</Link>
            </li>
          ) : null}
          {current ? (
            <li className="flex min-w-0 items-center gap-1.5">
              <ChevronRight aria-hidden className="size-3.5 shrink-0 text-line-strong" />
              <span aria-current="page" className="truncate px-1 text-ink">{current}</span>
            </li>
          ) : null}
        </ol>
      </nav>
      <ThemeToggle />
    </header>
  );
};
