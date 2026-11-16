import { ExternalLink } from 'lucide-react';
import type { ProductionTarget } from '@/features/production/types/ProductionTarget';
import { cn } from '@/shared/utils/cn';

interface ProductionTargetLinkProps {
  target: ProductionTarget;
  extraTargets?: number;
  className?: string;
}

/** A compact way out of Mooi to the service produced by a deployment. */
export const ProductionTargetLink = ({ target, extraTargets = 0, className }: ProductionTargetLinkProps) => (
  <a href={target.url} target="_blank" rel="noopener noreferrer" title={target.url}
    aria-label={`Open ${target.label}${extraTargets ? `; ${extraTargets} more deployment ${extraTargets === 1 ? 'target is' : 'targets are'} available` : ''}`}
    className={cn('inline-flex min-w-0 items-center gap-1.5 rounded-md text-xs font-semibold text-brand transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand', className)}>
    <span className="truncate">{target.label}</span>
    {extraTargets > 0 ? <span className="shrink-0 text-ink-subtle">+{extraTargets}</span> : null}
    <ExternalLink className="size-3.5 shrink-0" />
  </a>
);
