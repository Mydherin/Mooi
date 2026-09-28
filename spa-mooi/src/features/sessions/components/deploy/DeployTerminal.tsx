import { useLayoutEffect, useRef, useState } from 'react';
import { DeployEmptyTerminal } from './DeployEmptyTerminal';
import { DeployTerminalLine } from './DeployTerminalLine';
import { DeployTerminalToolbar } from './DeployTerminalToolbar';

export const DeployTerminal = ({ lines, operationId, label = 'Docker Compose output', emptyMessage }: { lines: string[]; operationId: string | null; label?: string; emptyMessage?: string }) => {
  const viewport = useRef<HTMLDivElement>(null);
  const previousOperation = useRef(operationId);
  const [following, setFollowing] = useState(true);
  const [copied, setCopied] = useState(false);
  const shouldFollow = useRef(true);

  useLayoutEffect(() => {
    if (previousOperation.current !== operationId) {
      previousOperation.current = operationId;
      shouldFollow.current = true;
      setFollowing(true);
      setCopied(false);
    }
    if (shouldFollow.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [lines, operationId]);

  const latest = () => {
    shouldFollow.current = true;
    setFollowing(true);
    if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); }
    catch { setCopied(false); }
  };

  return <div className="flex min-h-0 flex-1 flex-col bg-neutral-950 font-mono text-xs text-neutral-100">
    <DeployTerminalToolbar following={following} copied={copied} onCopy={() => void copy()}
      onToggleFollow={() => { shouldFollow.current = !shouldFollow.current; setFollowing(shouldFollow.current); if (shouldFollow.current) latest(); }} onLatest={latest} />
    <div ref={viewport} role="log" aria-label={label} aria-live="off" tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-400"
      onScroll={(event) => {
        if (!shouldFollow.current) return;
        const node = event.currentTarget;
        if (node.scrollHeight - node.scrollTop - node.clientHeight > 64) { shouldFollow.current = false; setFollowing(false); }
      }}>
      <pre>{lines.length
        ? lines.map((line, index) => <DeployTerminalLine key={index} line={line} />)
        : <DeployEmptyTerminal message={emptyMessage} />}</pre>
    </div>
  </div>;
};
