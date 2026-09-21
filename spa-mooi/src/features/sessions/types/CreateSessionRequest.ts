export interface CreateSessionRequest {
  projectId: string;
  provider: string;
  model?: string;
  effort?: string | null;
  branch: string;
  title?: string;
}
