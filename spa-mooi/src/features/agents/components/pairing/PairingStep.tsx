import type { ReactNode } from 'react';

interface PairingStepProps {
  index: number;
  title: string;
  description: string;
  children: ReactNode;
}

/** One numbered step of a provider sign-in. */
export const PairingStep = ({ index, title, description, children }: PairingStepProps) => (
  <section className="flex min-w-0 gap-3">
    <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-caption font-semibold text-brand-strong tabular-nums">
      {index}
    </span>
    <div className="min-w-0 flex-1">
      <h3 className="text-body font-semibold text-ink">{title}</h3>
      <p className="mt-0.5 mb-3 text-footnote text-ink-muted">{description}</p>
      {children}
    </div>
  </section>
);
