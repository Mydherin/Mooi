import { useRef, useState, type ReactNode } from 'react';
import { panelId, tabId } from '@/shared/components/navigation/Tabs';
import { useSwipeTabs } from '@/shared/gestures/useSwipeTabs';
import { cn } from '@/shared/utils/cn';

interface TabPanelsProps {
  /** Tab ids, in the strip's order. */
  ids: string[];
  value: string;
  onChange: (id: string) => void;
  /** The same prefix as the `Tabs` strip, linking each panel to its tab. */
  idPrefix: string;
  /** Horizontal swipe between panels on touch screens (the strip stays the visible equivalent). */
  swipeable?: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}

/**
 * The active tab's panel; only it is rendered. With `swipeable`, a horizontal swipe moves to the
 * neighbouring tab (it never fights vertical scroll, see `useSwipeTabs`) and the new panel slides
 * in from the side it came from.
 */
export const TabPanels = ({ ids, value, onChange, idPrefix, swipeable = false, children, className }: TabPanelsProps) => {
  const panel = useRef<HTMLDivElement>(null);
  const index = Math.max(0, ids.indexOf(value));
  const [direction, setDirection] = useState<'start' | 'end' | null>(null);
  const [previous, setPrevious] = useState(index);

  if (previous !== index) {
    setPrevious(index);
    setDirection(index > previous ? 'end' : 'start');
  }

  const swipe = useSwipeTabs({
    target: panel,
    index,
    count: ids.length,
    enabled: swipeable,
    onChange: (next) => { const id = ids[next]; if (id) onChange(id); },
  });

  return (
    <div
      key={value}
      ref={panel}
      role="tabpanel"
      id={panelId(idPrefix, value)}
      aria-labelledby={tabId(idPrefix, value)}
      onPointerDown={swipe.onPointerDown}
      className={cn('min-w-0', swipeable && 'touch-pan-y',
        direction === 'end' && 'animate-slide-in-end', direction === 'start' && 'animate-slide-in-start', className)}
    >
      {children(value)}
    </div>
  );
};
