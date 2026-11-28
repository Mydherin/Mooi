import { useEffect, useRef, type ReactNode } from 'react';
import { BackButton } from '@/shared/components/navigation/BackButton';
import { usePageChrome } from '@/shared/components/layout/PageChrome';
import { useCollapsedOnScroll } from '@/shared/components/layout/useCollapsedOnScroll';
import type { BackLink } from '@/shared/types/BackLink';
import { cn } from '@/shared/utils/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Small label above the title on desktop (the section, a kind). */
  eyebrow?: string;
  /** Leads back to the parent screen (nested routes). */
  back?: BackLink;
  /** A badge or status next to the title. */
  status?: ReactNode;
  /** Leading visual beside the title (initials, an avatar). */
  leading?: ReactNode;
  /** Header actions: one `ResponsiveActions` (primary inline, the rest in a menu on phones). */
  actions?: ReactNode;
  /** Below the title: tabs, a search field, filters. Sticks under the bar on phones. */
  children?: ReactNode;
  /** Phones show a large title that collapses into the bar on scroll; off for dense tool screens. */
  largeTitle?: boolean;
  className?: string;
}

const BAR = 56;

/**
 * The top of a screen. On phones: a frosted sticky bar (back, compact title, actions) above a
 * large title that slides under it as the page scrolls, the iOS navigation pattern. From `lg`:
 * one row with the title, subtitle and actions, while the shell's top bar shows breadcrumbs.
 * Registers its title for those breadcrumbs.
 */
export const PageHeader = ({ title, subtitle, eyebrow, back, status, leading, actions, children, largeTitle = true, className }: PageHeaderProps) => {
  const { scroller, setTitle } = usePageChrome();
  const large = useRef<HTMLDivElement>(null);
  const collapsed = useCollapsedOnScroll(large, scroller, BAR);
  const compactTitleVisible = !largeTitle || collapsed;

  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [setTitle, title]);

  return (
    <>
      <header className={cn('sticky top-0 z-header transition-[background-color,border-color] duration-200',
        compactTitleVisible ? 'border-b border-line bg-frosted' : 'border-b border-transparent bg-canvas', 'lg:static lg:border-transparent lg:bg-transparent lg:backdrop-filter-none', className)}>
        <div className="flex h-14 min-w-0 items-center gap-2 px-gutter lg:h-auto lg:items-start lg:pt-7 lg:pb-2">
          {back ? <BackButton back={back} compact={compactTitleVisible} className="lg:hidden" /> : null}
          <div className="min-w-0 flex-1">
            <p aria-hidden={!compactTitleVisible}
              className={cn('truncate text-headline text-ink transition-[opacity,translate] duration-200 lg:hidden',
                compactTitleVisible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0')}>
              {title}
            </p>
            <div className="hidden min-w-0 lg:block">
              {eyebrow ? <p className="mb-1 text-caption font-medium tracking-[0.04em] text-ink-subtle uppercase">{eyebrow}</p> : null}
              <div className="flex min-w-0 items-center gap-3">
                {leading}
                <h1 className="min-w-0 truncate text-title text-ink">{title}</h1>
                {status}
              </div>
              {subtitle ? <div className="mt-1 text-callout text-ink-muted">{subtitle}</div> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </div>
      </header>
      {largeTitle ? (
        <div ref={large} className="min-w-0 px-gutter pt-1 pb-2 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            {leading}
            <h1 className="min-w-0 text-large-title break-words text-ink">{title}</h1>
          </div>
          {status ? <div className="mt-2 flex flex-wrap items-center gap-2">{status}</div> : null}
          {subtitle ? <div className="mt-1.5 text-callout text-ink-muted">{subtitle}</div> : null}
        </div>
      ) : null}
      {children ? (
        <div className="sticky top-14 z-header min-w-0 border-b border-line bg-frosted px-gutter py-2 lg:static lg:border-transparent lg:bg-transparent lg:backdrop-filter-none">
          {children}
        </div>
      ) : null}
    </>
  );
};
