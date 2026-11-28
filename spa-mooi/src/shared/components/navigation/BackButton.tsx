import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BackLink } from '@/shared/types/BackLink';
import { cn } from '@/shared/utils/cn';

interface BackButtonProps {
  back: BackLink;
  /** Icon only (the label stays the accessible name). */
  compact?: boolean;
  className?: string;
}

/** "‹ Projects": where Back leads, named. A link, so it works from deep links too (see `useBackLink`). */
export const BackButton = ({ back, compact = false, className }: BackButtonProps) => (
  <Link to={back.to} aria-label={`Back to ${back.label}`}
    className={cn("relative -ml-2 inline-flex h-10 min-w-10 shrink-0 items-center gap-0.5 rounded-control pr-2 pl-1 text-callout font-medium text-brand transition before:absolute before:-inset-0.5 before:content-[''] active:opacity-60 hover-device:hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
      className)}>
    <ChevronLeft aria-hidden className="size-5.5 shrink-0" strokeWidth={2.25} />
    {compact ? null : <span className="max-w-[9rem] truncate">{back.label}</span>}
  </Link>
);
