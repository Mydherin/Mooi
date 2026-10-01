export interface PlatformEnvironmentVariable {
  name: string;
  configured: boolean;
  /** Read by the scripts without a shell default. */
  required: boolean;
  /** Owned by another configuration (development values reused by deployments, production values by backups): read-only here. */
  inherited?: boolean;
}
