export interface PermissionRequest {
  requestId: string;
  toolName: string;
  title: string;
  input: Record<string, unknown>;
}
