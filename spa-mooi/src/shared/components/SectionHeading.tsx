import { cn } from '@/shared/utils/cn';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'center' | 'left';
}

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  align = 'center',
}: SectionHeadingProps) => (
  <div className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : 'text-left')}>
    <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">{eyebrow}</p>
    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
      {title}
    </h2>
    <p className="mt-4 text-base leading-relaxed text-ink-muted">{description}</p>
  </div>
);
