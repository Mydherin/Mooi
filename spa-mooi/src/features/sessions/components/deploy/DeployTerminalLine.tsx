import type { DeploymentActivity } from '../../types/DeploymentActivity';
import { cn } from '@/shared/utils/cn';

export const DeployTerminalLine = ({ item }: { item: DeploymentActivity }) => {
  const time = Number.isNaN(Date.parse(item.at)) ? item.at : new Date(item.at).toLocaleTimeString(undefined, { hour12: false });
  return <span className="block min-w-0 py-0.5 leading-relaxed">
    <span className="flex flex-wrap gap-x-2 whitespace-pre-wrap break-words">
      <span className="text-neutral-500">{time}</span>
      <span className={cn('font-semibold', item.source === 'docker' ? 'text-sky-300' : item.source === 'probe' ? 'text-violet-300'
        : item.source === 'tool' ? 'text-cyan-300' : item.source === 'agent' ? 'text-blue-300' : 'text-neutral-400')}>{item.source}</span>
      <span className={cn(item.level === 'error' ? 'text-red-400' : item.level === 'warning' ? 'text-amber-300'
        : item.level === 'success' ? 'text-emerald-300' : 'text-neutral-500')}>{item.level}</span>
      {item.phase ? <span className="text-neutral-500">{item.phase}</span> : null}
      <span className="min-w-0 flex-1 text-neutral-100">{item.title}{item.status ? ` (${item.status})` : ''}</span>
    </span>
    {item.detail ? <span className="block whitespace-pre-wrap break-words pl-0 text-neutral-300 sm:pl-4">{item.detail}</span> : null}
  </span>;
};
