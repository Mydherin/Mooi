/** A batch of redacted Docker Compose command and output lines of one start operation. */
export interface DeploymentLog {
  operationId: string;
  /** Monotonic per operation: orders batches and drops duplicates on replay. */
  index: number;
  lines: string[];
}
