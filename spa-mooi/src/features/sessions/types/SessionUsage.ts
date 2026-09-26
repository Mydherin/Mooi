import type { UsageMetric } from './UsageMetric';

export interface SessionUsage {
  context?: UsageMetric | null;
  quota?: Record<string, UsageMetric> | null;
}
