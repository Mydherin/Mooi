import { Hourglass } from 'lucide-react';
import type { LimitsWait } from '@/features/sessions/types/LimitsWait';

interface LimitsWaitBarProps {
  wait: LimitsWait;
  busy: boolean;
  onAutoResumeChange: (autoResume: boolean) => void;
}

/** Local time of an epoch, with the date only when it is not today. */
const formatInstant = (epochSeconds: number): string => {
  const date = new Date(epochSeconds * 1000);
  const today = date.toDateString() === new Date().toDateString();
  return date.toLocaleString(undefined, today ? { hour: '2-digit', minute: '2-digit' }
    : { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * The strip above the composer while a turn waits for spent usage limits. Automatic resume comes
 * checked: the server continues the conversation at the renewal; unchecking leaves it to the user.
 */
export const LimitsWaitBar = ({ wait, busy, onAutoResumeChange }: LimitsWaitBarProps) => {
  const renewal = wait.resetsAt !== null && wait.resetsAt * 1000 > Date.now()
    ? `They renew at ${formatInstant(wait.resetsAt)}.` : 'Their renewal time is unknown.';
  const next = wait.autoResume ? `Mooi continues the conversation at ${formatInstant(wait.resumeAt)}.`
    : 'Send a message to continue once they renew.';
  return (
    <div role="status" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-warning/30 bg-warning-soft px-4 py-1.5 lg:px-6">
      <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 text-sm text-ink">
        <Hourglass className="mt-0.5 size-4 shrink-0 text-warning" />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          <span className="font-semibold">Usage limits reached.</span>{' '}
          <span className="text-ink-muted">{renewal} {next}</span>
        </span>
      </p>
      <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 text-sm font-medium text-ink has-disabled:cursor-default has-disabled:opacity-60">
        <input type="checkbox" checked={wait.autoResume} disabled={busy}
          onChange={(event) => onAutoResumeChange(event.target.checked)} className="size-4 accent-brand" />
        Resume automatically
      </label>
    </div>
  );
};
