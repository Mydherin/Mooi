export interface ProductionEnvironmentVariable {
  name: string;
  configured: boolean;
  /** Read by deploy.sh or status.sh without a shell default. */
  required: boolean;
}
