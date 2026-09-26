import { useId, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  /** Lets the trigger take focus, so touch and keyboard users can reveal the tooltip too. */
  focusable?: boolean;
  placement?: 'top' | 'bottom';
}

/** Hover (or keyboard focus) tooltip, never interactive, CSS-only so it also works inside links without nesting interactive elements. */
export const Tooltip = ({ content, children, className, focusable = false, placement = 'bottom' }: TooltipProps) => {
  const id = useId();
  return (
  <span
    tabIndex={focusable ? 0 : undefined}
    aria-describedby={focusable ? id : undefined}
    className={cn(
      'group/tooltip relative inline-flex max-w-full min-w-0 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
      className,
    )}
  >
    {children}
    <span
      id={id}
      role="tooltip"
      className={cn(placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5', "pointer-events-none invisible absolute left-0 z-50 w-max max-w-[min(32rem,calc(100vw-2rem))] translate-y-0.5 rounded-[8px] border border-line-strong bg-surface px-2.5 py-1.5 font-mono text-[11px] leading-snug break-all text-ink opacity-0 shadow-[0_8px_24px_rgb(0_0_0/0.18)] dark:shadow-[0_8px_24px_rgb(0_0_0/0.6)] transition duration-150 group-hover/tooltip:visible group-hover/tooltip:translate-y-0 group-hover/tooltip:opacity-100 group-focus-visible/tooltip:visible group-focus-visible/tooltip:translate-y-0 group-focus-visible/tooltip:opacity-100")}
    >
      {content}
    </span>
  </span>
  );
};
