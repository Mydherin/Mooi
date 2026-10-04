import type { ImageUpload } from '@/features/sessions/types/ImageUpload';

/** An image ready to send: its wire form and the local blob reused to display it without a download. */
export interface PreparedImage {
  upload: ImageUpload;
  blob: Blob;
}
