/** A drawable, orientation-corrected image. `createImageBitmap` first; an `<img>` covers formats it rejects (e.g. HEIC on Safari). */
export const decodeImage = async (blob: Blob): Promise<ImageBitmap | HTMLImageElement> => {
  try {
    return await createImageBitmap(blob);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const element = new Image();
      element.src = url;
      await element.decode();
      return element;
    } catch {
      throw new Error('This image format is not supported');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
};
