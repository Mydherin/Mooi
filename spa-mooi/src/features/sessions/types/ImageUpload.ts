/** One image as sent with a message: base64 bytes plus layout hints measured while preparing it. */
export interface ImageUpload {
  mediaType: string;
  data: string;
  name: string;
  width: number;
  height: number;
}
