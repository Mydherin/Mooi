import type { Integration } from '@/features/marketing/types/Integration';

interface IntegrationChipProps {
  integration: Integration;
}

export const IntegrationChip = ({ integration }: IntegrationChipProps) => {
  const Icon = integration.icon;

  return (
    <li className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-muted">
      <Icon className="size-4 text-ink-subtle" />
      {integration.label}
    </li>
  );
};
