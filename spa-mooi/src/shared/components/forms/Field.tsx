import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface FieldProps {
  /** Id of the control the label names. */
  htmlFor: string;
  label: string;
  /** Guidance under the control; replaced by `error` when there is one. */
  hint?: ReactNode;
  error?: string | null;
  hintId: string;
  required?: boolean;
  /** Visually hides the label (it still names the control). */
  hideLabel?: boolean;
  /** Trailing content on the label row (a counter, a "Generate" link). */
  labelAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label, control, then hint or error: the frame every form control sits in. Errors are announced. */
export const Field = ({ htmlFor, label, hint, error, hintId, required = false, hideLabel = false, labelAction, children, className }: FieldProps) => (
  <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <div className={cn('flex min-w-0 items-baseline justify-between gap-3', hideLabel && 'sr-only')}>
      <label htmlFor={htmlFor} className="truncate text-footnote font-semibold text-ink">
        {label}{required ? <span aria-hidden className="text-danger"> *</span> : null}
      </label>
      {labelAction}
    </div>
    {children}
    {error ? <p id={hintId} role="alert" className="text-footnote break-words text-danger">{error}</p>
      : hint ? <p id={hintId} className="text-footnote break-words text-ink-subtle">{hint}</p> : null}
  </div>
);
