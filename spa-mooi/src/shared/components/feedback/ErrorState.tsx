import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/components/actions/Button';
import { cn } from '@/shared/utils/cn';

interface ErrorStateProps {
  title?: string;
  /** What failed, in plain words (usually the API's message). */
  description: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/** A view that could not load: what happened and the way out. Never a blank screen. */
export const ErrorState = ({ title = 'Something went wrong', description, onRetry, retrying = false, className }: ErrorStateProps) => (
  <div role="alert" className={cn('flex animate-fade-up flex-col items-center justify-center rounded-card border border-danger/25 bg-surface px-6 py-10 text-center', className)}>
    <span className="flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger">
      <TriangleAlert aria-hidden className="size-5" />
    </span>
    <h3 className="mt-4 text-headline text-ink">{title}</h3>
    <p className="mt-1.5 max-w-sm text-callout break-words text-ink-muted">{description}</p>
    {onRetry ? <Button variant="secondary" icon={RotateCw} loading={retrying} onClick={onRetry} className="mt-5">Try again</Button> : null}
  </div>
);
