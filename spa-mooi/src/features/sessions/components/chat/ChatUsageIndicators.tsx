import { useCallback, useRef, useState } from 'react';
import { Activity, Eraser, Layers3, LoaderCircle } from 'lucide-react';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { useOnEscape } from '@/shared/hooks/useOnEscape';
import { cn } from '@/shared/utils/cn';
import { contextHandoverOptions, parseContextHandover } from '@/features/sessions/lib/contextHandover';
import { fiveHourLimit } from '@/features/sessions/lib/fiveHourLimit';
import type { SessionUsage } from '@/features/sessions/types/SessionUsage';
import type { UsageMetric } from '@/features/sessions/types/UsageMetric';

const formatTime = (seconds: number) => new Date(seconds * 1000).toLocaleString();
const percent = (metric?: UsageMetric | null) =>
  typeof metric?.percent === 'number' && Number.isFinite(metric.percent)
    ? `${Math.round(metric.percent)}%` : null;

const Row = ({ label, metric, loading = false }: { label: string; metric?: UsageMetric | null; loading?: boolean }) => (
  <span className="flex items-center justify-between gap-6">
    <span className="font-semibold text-ink">{label}</span>
    <span className="flex items-center gap-1.5 font-semibold">
      {percent(metric) ?? (loading ? <LoaderCircle className="size-3 animate-spin" aria-label="Loading" /> : 'Unavailable')}
    </span>
  </span>
);

const QuotaRow = ({ label, metric }: { label: string; metric?: UsageMetric | null }) => {
  if (percent(metric) == null) return null;
  return (
    <span className="flex flex-col gap-1">
      <Row label={label} metric={metric} />
      {metric?.resetsAt && <span className="text-ink-subtle">Resets {formatTime(metric.resetsAt)}</span>}
    </span>
  );
};

interface ChatUsageIndicatorsProps {
  usage?: SessionUsage;
  loading?: boolean;
  actionsDisabled: boolean;
  onCompact: () => Promise<boolean>;
  onClear: () => Promise<boolean>;
  /** The context percent that makes the agent hand its work over; offered only with a change handler. */
  contextHandover?: number | null;
  contextHandoverDisabled?: boolean;
  onContextHandoverChange?: (percent: number | null) => void;
}

export const ChatUsageIndicators = ({ usage, loading = false, actionsDisabled, onCompact, onClear, contextHandover = null,
  contextHandoverDisabled = false, onContextHandoverChange }: ChatUsageIndicatorsProps) => {
  const quotas = usage?.quota ?? {};
  const fiveHour = fiveHourLimit(usage);
  const weekly = quotas.seven_day ?? quotas.secondary;
  const extras = Object.entries(quotas).filter(([key]) => !['five_hour', 'primary', 'seven_day', 'secondary'].includes(key));
  const context = usage?.context;
  const known = Object.values(quotas).filter((metric) => percent(metric) != null);
  const updatedAt = Math.min(...known.map((metric) => metric.updatedAt));
  // Hover and focus reveal it with a mouse; a tap toggles it, since touch has neither.
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOnClickOutside(containerRef, close, open);
  useOnEscape(close, open);
  return (
    <span ref={containerRef} className="group/context relative inline-flex shrink-0" onMouseLeave={(event) => {
      if (event.currentTarget.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      close();
    }}>
      <button type="button" aria-label="Context usage and conversation actions" aria-haspopup="true" aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex size-8 shrink-0 items-center justify-center rounded-full sm:size-9 text-sky-500 transition hover-device:hover:bg-sky-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Activity className="size-4" aria-hidden="true" />}
      </button>
      <span className={cn('absolute bottom-full left-0 z-50 w-max max-w-[calc(100vw-2rem)] pb-2 transition duration-150', open
        ? 'pointer-events-auto visible opacity-100'
        : 'pointer-events-none invisible opacity-0 group-hover/context:pointer-events-auto group-hover/context:visible group-hover/context:opacity-100 group-focus-within/context:pointer-events-auto group-focus-within/context:visible group-focus-within/context:opacity-100')}>
        <span className="flex min-w-56 flex-col gap-2 rounded-xl border border-line-strong bg-surface p-3 font-sans text-xs font-medium normal-case text-ink shadow-pop">
        <Row label="Context used" metric={context} loading={loading} />
        {context?.limitTokens != null && <span className="text-ink-subtle">{(context.usedTokens ?? 0).toLocaleString()} / {context.limitTokens.toLocaleString()} tokens</span>}
        <span className="h-px bg-line" />
        <span className="flex items-center gap-2">
          <span className="mr-auto font-semibold text-ink-subtle">Conversation</span>
          <button type="button" title="Compact context" aria-label="Compact conversation context" disabled={actionsDisabled}
            onClick={() => void onCompact()}
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition hover-device:hover:bg-surface-2 hover-device:hover:text-ink focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40">
            <Layers3 className="size-4" aria-hidden="true" />
          </button>
          <button type="button" title="Clear conversation" aria-label="Clear conversation and start fresh" disabled={actionsDisabled}
            onClick={() => void onClear()}
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition hover-device:hover:bg-danger-soft hover-device:hover:text-danger focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40">
            <Eraser className="size-4" aria-hidden="true" />
          </button>
        </span>
        {onContextHandoverChange && <label className="flex items-center gap-3"
          title="Past this context, the agent wraps up and leaves a progress file in docs/progress/ for the next conversation.">
          <span className="mr-auto font-semibold text-ink-subtle">Handover</span>
          <select aria-label="Context handover" value={contextHandover == null ? '' : String(contextHandover)}
            disabled={contextHandoverDisabled} onChange={(event) => onContextHandoverChange(parseContextHandover(event.target.value))}
            className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs font-semibold text-ink outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-40">
            {contextHandoverOptions(contextHandover).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>}
        {known.length > 0 && <span className="h-px bg-line" />}
        <QuotaRow label="5 hour limit" metric={fiveHour} />
        <QuotaRow label="Weekly limit" metric={weekly} />
        {extras.map(([key, metric]) => <QuotaRow key={key} label={key.replaceAll('_', ' ')} metric={metric} />)}
        {Number.isFinite(updatedAt) && updatedAt > 0 && <span className="text-ink-subtle">Updated {formatTime(updatedAt)}</span>}
        </span>
      </span>
    </span>
  );
};
