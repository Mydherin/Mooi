/** DEPLOYMENT.md, deploy.sh and status.sh: stored only in the platform, never in the repository. */
export interface ProductionFiles {
  manifest: string;
  script: string;
  statusScript: string | null;
}
