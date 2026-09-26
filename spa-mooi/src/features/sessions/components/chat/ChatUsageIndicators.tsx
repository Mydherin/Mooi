import { Activity, LoaderCircle } from 'lucide-react';
import type { SessionUsage } from '@/features/sessions/types/SessionUsage';
import type { UsageMetric } from '@/features/sessions/types/UsageMetric';
import { Tooltip } from '@/shared/components/Tooltip';

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

export const ChatUsageIndicators = ({ usage, loading = false }: { usage?: SessionUsage; loading?: boolean }) => {
  const quotas = usage?.quota ?? {};
  const fiveHour = quotas.five_hour ?? quotas.primary;
  const weekly = quotas.seven_day ?? quotas.secondary;
  const extras = Object.entries(quotas).filter(([key]) => !['five_hour', 'primary', 'seven_day', 'secondary'].includes(key));
  const context = usage?.context;
  const known = Object.values(quotas).filter((metric) => percent(metric) != null);
  const updatedAt = Math.min(...known.map((metric) => metric.updatedAt));
  return (
    <Tooltip placement="top" content={
      <span className="flex min-w-56 flex-col gap-2 font-sans text-xs normal-case">
        <Row label="Context used" metric={context} loading={loading} />
        {context?.limitTokens != null && <span className="text-ink-subtle">{(context.usedTokens ?? 0).toLocaleString()} / {context.limitTokens.toLocaleString()} tokens</span>}
        {known.length > 0 && <span className="h-px bg-line" />}
        <QuotaRow label="5 hour limit" metric={fiveHour} />
        <QuotaRow label="Weekly limit" metric={weekly} />
        {extras.map(([key, metric]) => <QuotaRow key={key} label={key.replaceAll('_', ' ')} metric={metric} />)}
        {Number.isFinite(updatedAt) && updatedAt > 0 && <span className="text-ink-subtle">Updated {formatTime(updatedAt)}</span>}
      </span>
    }>
      <span role="img" aria-label="Session status and usage" className="flex size-9 shrink-0 items-center justify-center rounded-full text-sky-500 hover:bg-sky-500/10">
        {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Activity className="size-4" aria-hidden="true" />}
      </span>
    </Tooltip>
  );
};
