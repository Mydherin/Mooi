import type { ImageAttachment } from '@/features/sessions/types/ImageAttachment';

export interface TranscriptStep {
  toolUseId: string;
  name: string;
  title: string;
  input: Record<string, unknown>;
  status: 'running' | 'done' | 'failed';
  summary: string | null;
  /** Images the tool returned or generated, stored with the session. */
  images: ImageAttachment[];
}
