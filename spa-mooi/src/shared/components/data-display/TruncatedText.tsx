import { useLayoutEffect, useRef, useState } from 'react';
import { Tooltip } from '@/shared/components/overlays/tooltip/Tooltip';
import { cn } from '@/shared/utils/cn';

interface TruncatedTextProps {
  text: string;
  /** Clip the start instead of the end, so the distinctive tail of a path or branch stays visible. */
  from?: 'end' | 'start';
  /** Wrap to this many lines before clipping (end only). */
  lines?: 2 | 3;
  mono?: boolean;
  className?: string;
}

const clamps = { 2: 'line-clamp-2', 3: 'line-clamp-3' };

/**
 * Text that may not fit: clipped with an ellipsis, and only when it actually is, its full value is
 * reachable by hover and keyboard focus on desktop and by a long press on touch screens.
 */
export const TruncatedText = ({ text, from = 'end', lines, mono = false, className }: TruncatedTextProps) => {
  const element = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = () => setClipped(node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);

  const label = (
    <span ref={element} className={cn('block min-w-0', lines && from === 'end' ? clamps[lines] : from === 'start' ? 'truncate-start' : 'truncate',
      mono && 'font-mono', className)}>
      {from === 'start' ? <span dir="ltr">{text}</span> : text}
    </span>
  );

  return clipped ? <Tooltip content={text} mono={mono} focusable className="flex w-full">{label}</Tooltip> : label;
};
