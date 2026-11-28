import { Clock, Coins, TriangleAlert } from 'lucide-react';
import type { TurnResult } from '@/features/sessions/types/TurnResult';
import { CopyButton } from '@/shared/components/actions/CopyButton';

interface TurnFooterProps {
  result: TurnResult;
  showCost: boolean;
  /** What the agent told the user in this turn, offered for copying when there is any. */
  text: string;
}

const formatTurnDuration = (ms: number): string =>
  ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;

const formatCost = (usd: number): string => `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`;

/**
 * Everything here is best-effort on the wire: only `terminalReason` is required of an adapter, and
 * the cost line is gated on the `cost` capability rather than on the provider id, so a provider that
 * reports nothing renders only the copy action.
 */
export const TurnFooter = ({ result, showCost, text }: TurnFooterProps) => {
  const failed = result.terminalReason === 'error';
  const interrupted = result.terminalReason === 'interrupted';
  const cost = showCost && result.costUsd !== null ? formatCost(result.costUsd) : null;
  const duration = result.durationMs !== null ? formatTurnDuration(result.durationMs) : null;

  if (!failed && !interrupted && cost === null && duration === null && !text) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-subtle tabular-nums">
      {text ? <CopyButton value={text} label="Copy answer" className="-ml-2.5" /> : null}
      {duration ? <span className="flex items-center gap-1"><Clock aria-hidden className="size-3.5" />{duration}</span> : null}
      {cost ? <span className="flex items-center gap-1"><Coins aria-hidden className="size-3.5" />{cost}</span> : null}
      {failed || interrupted ? (
        <span className="flex items-center gap-1 text-warning">
          <TriangleAlert aria-hidden className="size-3.5" />{interrupted ? 'Stopped' : 'Turn failed'}
        </span>
      ) : null}
    </div>
  );
};
