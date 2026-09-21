export interface TranscriptStep {
  toolUseId: string;
  name: string;
  title: string;
  input: Record<string, unknown>;
  status: 'running' | 'done' | 'failed';
  summary: string | null;
}
