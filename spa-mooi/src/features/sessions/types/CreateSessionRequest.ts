export interface CreateSessionRequest {
  projectId: string;
  provider: string;
  connectionId: string;
  model?: string;
  effort?: string | null;
  branch: string;
}
