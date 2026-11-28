import { ArrowDownToLine, Check, Copy, Pause, Play } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface DeployTerminalToolbarProps {
  following: boolean;
  copied: boolean;
  /** The log scrolls with its parent, so the toolbar sticks to the top of that scroller. */
  sticky?: boolean;
  onCopy: () => void;
  onToggleFollow: () => void;
  onLatest: () => void;
}

const button = 'inline-flex min-h-11 items-center gap-1.5 rounded-control px-2.5 text-footnote text-neutral-300 transition active:bg-neutral-800 hover-device:hover:bg-neutral-800 hover-device:hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400';

export const DeployTerminalToolbar = ({ following, copied, sticky = false, onCopy, onToggleFollow, onLatest }: DeployTerminalToolbarProps) => (
  <div className={cn('flex flex-wrap items-center gap-1 border-b border-neutral-800 bg-neutral-950 px-2 sm:px-3', sticky && 'sticky top-0 z-sticky')}>
    <button type="button" className={button} onClick={onCopy} aria-label="Copy logs">
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}{copied ? 'Copied' : 'Copy'}</button>
    <button type="button" className={button} onClick={onToggleFollow} aria-label={following ? 'Pause auto-scroll' : 'Resume auto-scroll'}>
      {following ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}{following ? 'Pause' : 'Follow'}</button>
    <button type="button" className={button} onClick={onLatest} aria-label="Jump to latest">
      <ArrowDownToLine aria-hidden className="size-4" />Latest</button>
  </div>
);
