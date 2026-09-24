import { ArrowDownToLine, Check, Copy, Pause, Play } from 'lucide-react';

export const DeployTerminalToolbar = ({ following, copied, onCopy, onToggleFollow, onLatest }: {
  following: boolean; copied: boolean; onCopy: () => void; onToggleFollow: () => void; onLatest: () => void;
}) => {
  const button = 'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400';
  return <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800 px-3 py-2 sm:px-4">
    <button type="button" className={button} onClick={onCopy} aria-label="Copy logs" title="Copy logs">
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
    <button type="button" className={button} onClick={onToggleFollow} aria-label={following ? 'Pause auto-scroll' : 'Resume auto-scroll'}
      title={following ? 'Pause auto-scroll' : 'Resume auto-scroll'}>
      {following ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{following ? 'Pause' : 'Follow'}</button>
    <button type="button" className={button} onClick={onLatest} aria-label="Jump to latest" title="Jump to latest">
      <ArrowDownToLine className="size-3.5" />Latest</button>
  </div>;
};
