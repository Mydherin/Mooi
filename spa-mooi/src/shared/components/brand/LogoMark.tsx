import { cn } from '@/shared/utils/cn';

interface LogoMarkProps {
  className?: string;
  /** Lets the agent orb emit a slow halo, for places where the brand should feel alive. */
  live?: boolean;
}

/**
 * The Mooi mark: a speech bubble (the person asking) and a vivid orb (the agent answering),
 * together the "oo" of the name. Built to stay legible down to a 16px favicon.
 */
export const LogoMark = ({ className, live = false }: LogoMarkProps) => (
  <svg viewBox="0 0 64 64" role="img" aria-hidden className={cn('size-8 overflow-visible', className)}>
    <rect width="64" height="64" rx="16" className="fill-contrast" />
    <path
      d="M23.5 40.6A13 13 0 1 0 16.4 33.9L14.5 44.5Z"
      fill="none"
      className="stroke-contrast-ink"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {live ? (
      <circle cx="43" cy="42" r="9.5" className="origin-center animate-orb-ping fill-brand-vivid [transform-box:fill-box]" />
    ) : null}
    <circle cx="43" cy="42" r="9.5" className="fill-brand-vivid stroke-contrast" strokeWidth="4" paintOrder="stroke" />
  </svg>
);
