/** An image stored with a session message; the bytes are fetched on demand by `id`. */
export interface ImageAttachment {
  id: string;
  mediaType: string;
  name: string;
  size: number;
  width: number | null;
  height: number | null;
}
