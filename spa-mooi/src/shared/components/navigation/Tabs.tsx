import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import type { TabItem } from '@/shared/types/TabItem';
import { cn } from '@/shared/utils/cn';
import { formatCount } from '@/shared/utils/formatCount';

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  /** Prefix for tab/panel ids, so `TabPanels` can link each panel to its tab. */
  idPrefix?: string;
  className?: string;
}

const FADE = '20px';
/** Width of the indicator before scaling: it moves and stretches with transform only. */
const INDICATOR = 100;

/** Fades whichever edge still hides tabs, so a strip wider than a phone reads as scrollable. */
const edgeMask = (start: boolean, end: boolean): string | undefined =>
  start || end
    ? `linear-gradient(to right, ${start ? 'transparent' : '#000'}, #000 ${FADE}, #000 calc(100% - ${FADE}), ${end ? 'transparent' : '#000'})`
    : undefined;

export const tabId = (prefix: string, id: string): string => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string): string => `${prefix}-panel-${id}`;

/**
 * A horizontally scrollable strip of tabs with one indicator that slides and stretches to the
 * active tab (transform only), edge fades while tabs are hidden, the active tab scrolled into
 * view, and arrow-key / Home / End navigation.
 */
export const Tabs = ({ items, value, onChange, ariaLabel, idPrefix, className }: TabsProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      const start = list.scrollLeft > 1;
      const end = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
      const active = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      const indicator = indicatorRef.current;
      if (!indicator) return;
      indicator.style.opacity = active ? '1' : '0';
      if (active) indicator.style.transform = `translateX(${active.offsetLeft + 8}px) scaleX(${Math.max(0, active.offsetWidth - 16) / INDICATOR})`;
    };
    update();
    list.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(list);
    Array.from(list.children).forEach((child) => observer.observe(child));
    return () => {
      list.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [items, value]);

  useLayoutEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === value);
    const next = event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
    const target = next === null ? undefined : items[next];
    if (!target) return;
    event.preventDefault();
    onChange(target.id);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };

  const mask = edgeMask(edges.start, edges.end);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      data-swipe-ignore
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      className={cn('scrollbar-none relative flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain', className)}
    >
      <span ref={indicatorRef} aria-hidden style={{ width: INDICATOR }}
        className="pointer-events-none absolute bottom-0 left-0 h-0.5 origin-left rounded-full bg-ink opacity-0 transition-transform duration-300 ease-spring" />
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === value;

        const tab = (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={idPrefix ? tabId(idPrefix, item.id) : undefined}
            aria-controls={idPrefix ? panelId(idPrefix, item.id) : undefined}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'group/tab relative flex min-h-11 shrink-0 items-center gap-2 rounded-chip px-2.5 text-[13px] font-medium transition-colors duration-150 active:opacity-70',
              isActive ? 'text-ink' : 'text-ink-muted hover-device:hover:text-ink',
            )}
          >
            {Icon ? <Icon aria-hidden className={cn('size-4 transition-colors', isActive ? 'text-ink' : 'text-ink-subtle group-hover/tab:text-ink-muted')} /> : null}
            {item.label}
            {typeof item.count === 'number' ? (
              <span
                title={item.count >= 1000 ? item.count.toLocaleString('en') : undefined}
                className={cn(
                  'min-w-5 rounded-full px-1.5 py-px text-center font-mono text-[10.5px] font-medium tabular-nums transition-colors',
                  isActive ? 'bg-contrast text-contrast-ink' : 'bg-surface-3 text-ink-muted',
                )}
              >
                {formatCount(item.count)}
              </span>
            ) : null}
            {item.dot ? (
              <span aria-hidden className="relative flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-success-dot opacity-60" />
                <span className="relative size-1.5 rounded-full bg-success-dot" />
              </span>
            ) : null}
          </button>
        );
        if (!item.onClose) return tab;
        const closeLabel = item.closeLabel ?? `Close ${item.label}`;

        return (
          <div key={item.id} className="flex shrink-0 items-center gap-0.5">
            {tab}
            <button type="button" onClick={item.onClose} aria-label={closeLabel} title={closeLabel}
              className="relative flex size-7 items-center justify-center rounded-md text-ink-subtle transition before:absolute before:-inset-2 before:content-[''] hover-device:hover:bg-surface-2 hover-device:hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              <X aria-hidden className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
