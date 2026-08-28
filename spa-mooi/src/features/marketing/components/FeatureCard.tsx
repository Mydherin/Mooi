import type { MarketingFeature } from '@/features/marketing/types/MarketingFeature';
import { Card } from '@/shared/components/Card';

interface FeatureCardProps {
  feature: MarketingFeature;
}

export const FeatureCard = ({ feature }: FeatureCardProps) => {
  const Icon = feature.icon;

  return (
    <Card
      as="li"
      className="group relative h-full overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:border-line-strong"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
      />

      <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <Icon className="size-5" />
      </span>

      <h3 className="mt-5 text-base font-semibold tracking-tight text-ink">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.description}</p>
    </Card>
  );
};
