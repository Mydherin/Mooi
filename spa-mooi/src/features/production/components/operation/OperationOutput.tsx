import { cn } from '@/shared/utils/cn';

interface OperationOutputProps {
  content: string;
  /** `log`: the dark terminal look of recorded output; `file`: a script or manifest on the surface. */
  kind: 'log' | 'file';
  label: string;
}

/**
 * A recorded output or a script, as written: lines never wrap, so long ones scroll sideways inside
 * this box only, and it scrolls on its own without dragging the dialog along.
 */
export const OperationOutput = ({ content, kind, label }: OperationOutputProps) => (
  <pre role="region" aria-label={label} tabIndex={0} data-swipe-ignore
    className={cn('max-h-[50dvh] min-h-32 overflow-auto overscroll-contain rounded-card p-4 font-mono text-mono whitespace-pre focus-visible:outline-2 focus-visible:outline-brand',
      kind === 'log' ? 'bg-neutral-950 text-neutral-100' : 'border border-line bg-surface-2 text-ink')}>
    {content}
  </pre>
);
