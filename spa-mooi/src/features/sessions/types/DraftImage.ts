import type { PreparedImage } from '@/features/sessions/types/PreparedImage';

/** An image attached to the composer draft, shown immediately while it is being prepared. */
export interface DraftImage {
  key: string;
  name: string;
  previewUrl: string;
  status: 'preparing' | 'ready' | 'failed';
  prepared: PreparedImage | null;
  error: string | null;
}
