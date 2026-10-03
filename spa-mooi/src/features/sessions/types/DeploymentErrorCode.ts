export type DeploymentErrorCode =
  | 'unsupported_project' | 'docker_unavailable' | 'invalid_compose'
  | 'startup_failed' | 'health_check_failed' | 'timeout' | 'cancelled' | 'cleanup_failed';
