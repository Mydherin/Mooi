export type DeploymentErrorCode =
  | 'not_web_application' | 'missing_configuration' | 'unsupported_project'
  | 'provider_unavailable' | 'model_unavailable' | 'docker_unavailable' | 'invalid_compose'
  | 'port_unavailable' | 'startup_failed' | 'health_check_failed' | 'invalid_agent_output'
  | 'timeout' | 'cancelled' | 'cleanup_failed';
