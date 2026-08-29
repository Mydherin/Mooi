import type { ReactNode } from 'react';
import { Card } from '@/shared/components/Card';

interface DashboardStatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}

/**
 * Takes a rendered icon rather than an icon component: the GitHub mark is an inline SVG of our own
 * and not a lucide icon, and the dashboard must be able to show it next to the lucide ones.
 */
export const DashboardStatCard = ({ icon, label, value, hint }: DashboardStatCardProps) => (
  <Card className="p-4">
    <span className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-ink-subtle uppercase">
      {icon}
      {label}
    </span>
    <p className="mt-3 truncate text-xl font-semibold tracking-tight text-ink">{value}</p>
    <p className="mt-1 truncate text-xs text-ink-subtle">{hint}</p>
  </Card>
);
