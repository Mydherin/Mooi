/** The raw base64 payload of a blob, without its `data:` URL prefix. */
export const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1));
  reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'));
  reader.readAsDataURL(blob);
});
