/** The agent every factory session runs with until the next pause. */
export interface FactoryRunConfig {
  provider: string;
  connectionId: string;
  adapter?: string | null;
  model?: string | null;
  effort?: string | null;
}
