import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { DeployEmptyTerminal } from './DeployEmptyTerminal';
import { DeployTerminalLine } from './DeployTerminalLine';
import { DeployTerminalToolbar } from './DeployTerminalToolbar';

interface DeployTerminalProps {
  lines: string[];
  operationId: string | null;
  label?: string;
  emptyMessage?: string;
  /**
   * Scroll with the surrounding sheet body (`[data-scroller]`) instead of an inner scroller, so a
   * sheet's drag-to-dismiss and the log never fight over the same vertical gesture.
   */
  scrollWithParent?: boolean;
}

const FOLLOW_SLACK = 64;

/** Live command output that follows the tail until the reader scrolls up; copy, pause and jump to latest. */
export const DeployTerminal = ({ lines, operationId, label = 'Docker Compose output', emptyMessage, scrollWithParent = false }: DeployTerminalProps) => {
  const own = useRef<HTMLDivElement>(null);
  const previousOperation = useRef(operationId);
  const [following, setFollowing] = useState(true);
  const [copied, setCopied] = useState(false);
  const shouldFollow = useRef(true);

  const viewport = (): HTMLElement | null =>
    scrollWithParent ? own.current?.closest<HTMLElement>('[data-scroller]') ?? null : own.current;

  const toBottom = () => {
    const element = viewport();
    if (element) element.scrollTop = element.scrollHeight;
  };

  useLayoutEffect(() => {
    if (previousOperation.current !== operationId) {
      previousOperation.current = operationId;
      shouldFollow.current = true;
      setFollowing(true);
      setCopied(false);
    }
    if (shouldFollow.current) toBottom();
  });

  useLayoutEffect(() => {
    const element = viewport();
    if (!element) return;
    const onScroll = () => {
      if (!shouldFollow.current) return;
      if (element.scrollHeight - element.scrollTop - element.clientHeight > FOLLOW_SLACK) {
        shouldFollow.current = false;
        setFollowing(false);
      }
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
    // The viewport element is fixed for the terminal's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollWithParent]);

  const latest = () => {
    shouldFollow.current = true;
    setFollowing(true);
    toBottom();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); }
    catch { setCopied(false); }
  };

  return <div className={cn('flex flex-col bg-neutral-950 font-mono text-mono text-neutral-100', scrollWithParent ? 'min-h-full' : 'min-h-0 flex-1')}>
    <DeployTerminalToolbar following={following} copied={copied} onCopy={() => void copy()} sticky={scrollWithParent}
      onToggleFollow={() => { if (shouldFollow.current) { shouldFollow.current = false; setFollowing(false); } else latest(); }} onLatest={latest} />
    <div ref={own} role="log" aria-label={label} aria-live="off" tabIndex={0}
      className={cn('p-4 pb-[calc(1rem+var(--safe-bottom))] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-400',
        scrollWithParent ? 'flex-1' : 'min-h-0 flex-1 overflow-y-auto overscroll-contain')}>
      <pre className="whitespace-pre-wrap">{lines.length
        ? lines.map((line, index) => <DeployTerminalLine key={index} line={line} />)
        : <DeployEmptyTerminal message={emptyMessage} />}</pre>
    </div>
  </div>;
};
