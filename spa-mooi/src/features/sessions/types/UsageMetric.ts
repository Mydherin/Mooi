export interface UsageMetric {
  percent: number | null;
  updatedAt: number;
  usedTokens?: number | null;
  limitTokens?: number | null;
  window?: string | null;
  resetsAt?: number | null;
  status?: string | null;
}
