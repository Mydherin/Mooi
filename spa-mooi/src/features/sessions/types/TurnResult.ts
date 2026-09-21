export interface TurnResult {
  terminalReason: string | null;
  subtype: string | null;
  durationMs: number | null;
  costUsd: number | null;
  usage: Record<string, unknown> | null;
}
