import { useLayoutEffect, useRef, useState } from 'react';
import type { DeploymentActivity } from '../../types/DeploymentActivity';
import { formatDeploymentActivity } from '../../lib/formatDeploymentActivity';
import { DeployEmptyTerminal } from './DeployEmptyTerminal';
import { DeployTerminalLine } from './DeployTerminalLine';
import { DeployTerminalToolbar } from './DeployTerminalToolbar';

export const DeployTerminal = ({ activity, operationId }: { activity: DeploymentActivity[]; operationId: string | null }) => {
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
  }, [activity, operationId]);

  const latest = () => {
    shouldFollow.current = true;
    setFollowing(true);
    if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  };
  const copy = async () => {
    const value = activity.map(formatDeploymentActivity).join('\n');
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (copied) {
      setCopied(true);
      return;
    }
    try { await navigator.clipboard.writeText(value); setCopied(true); }
    catch { setCopied(false); }
  };

  return <div className="flex min-h-0 flex-1 flex-col bg-neutral-950 font-mono text-xs text-neutral-100">
    <DeployTerminalToolbar following={following} copied={copied} onCopy={() => void copy()}
      onToggleFollow={() => { shouldFollow.current = !shouldFollow.current; setFollowing(shouldFollow.current); if (shouldFollow.current) latest(); }} onLatest={latest} />
    <div ref={viewport} role="log" aria-label="Deployment activity" aria-live="off" tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-400"
      onScroll={(event) => {
        if (!shouldFollow.current) return;
        const node = event.currentTarget;
        if (node.scrollHeight - node.scrollTop - node.clientHeight > 64) { shouldFollow.current = false; setFollowing(false); }
      }}>
      <pre className="whitespace-pre-wrap break-words">{activity.length
        ? activity.map((item) => <DeployTerminalLine key={`${item.operationId}:${item.index}`} item={item} />)
        : <DeployEmptyTerminal />}</pre>
    </div>
  </div>;
};
