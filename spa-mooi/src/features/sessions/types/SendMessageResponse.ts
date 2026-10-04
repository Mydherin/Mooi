import type { ImageAttachment } from '@/features/sessions/types/ImageAttachment';

export interface SendMessageResponse {
  seq: number;
  images?: ImageAttachment[];
}
