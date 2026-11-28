import { Activity, Eraser, Layers3 } from 'lucide-react';
import { IconButton } from '@/shared/components/actions/IconButton';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { SelectField } from '@/shared/components/forms/select/SelectField';
import { Popover } from '@/shared/components/overlays/popover/Popover';
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
      {percent(metric) ?? (loading ? <Spinner label="Loading" className="size-3" /> : 'Unavailable')}
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
  return (
    <Popover label="Context and limits" placement="top-start" className="w-72"
      renderTrigger={(props) => (
        <button {...props} type="button" aria-label="Context usage and conversation actions"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-info transition hover-device:hover:bg-info-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:size-9">
          {loading ? <Spinner /> : <Activity className="size-4" aria-hidden />}
        </button>
      )}
      content={(
        <div className="flex flex-col gap-3 text-footnote text-ink">
          <Row label="Context used" metric={context} loading={loading} />
          {context?.limitTokens != null && <span className="text-ink-subtle">{(context.usedTokens ?? 0).toLocaleString()} / {context.limitTokens.toLocaleString()} tokens</span>}
          <span className="h-px bg-line" />
          <span className="flex items-center gap-1">
            <span className="mr-auto font-semibold text-ink-subtle">Conversation</span>
            <IconButton icon={Layers3} label="Compact conversation context" size="sm" disabled={actionsDisabled} onClick={() => void onCompact()} />
            <IconButton icon={Eraser} label="Clear conversation and start fresh" size="sm" disabled={actionsDisabled} onClick={() => void onClear()} />
          </span>
          {onContextHandoverChange && (
            <SelectField label="Handover" value={contextHandover == null ? '' : String(contextHandover)} disabled={contextHandoverDisabled}
              options={contextHandoverOptions(contextHandover)} onChange={(value) => onContextHandoverChange(parseContextHandover(value))}
              hint="Past this context, the agent wraps up and leaves a progress file in docs/progress/ for the next conversation." />
          )}
          {known.length > 0 && <span className="h-px bg-line" />}
          <QuotaRow label="5 hour limit" metric={fiveHour} />
          <QuotaRow label="Weekly limit" metric={weekly} />
          {extras.map(([key, metric]) => <QuotaRow key={key} label={key.replaceAll('_', ' ')} metric={metric} />)}
          {Number.isFinite(updatedAt) && updatedAt > 0 && <span className="text-ink-subtle">Updated {formatTime(updatedAt)}</span>}
        </div>
      )} />
  );
};
