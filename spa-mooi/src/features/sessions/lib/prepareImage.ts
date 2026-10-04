import { blobToBase64 } from './blobToBase64';
import { decodeImage } from './decodeImage';
import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE, SENDABLE_IMAGE_TYPES } from './imageLimits';
import type { PreparedImage } from '@/features/sessions/types/PreparedImage';

const LOSSLESS = ['image/png', 'image/gif', 'image/webp'];
const JPEG_QUALITIES = [0.9, 0.8, 0.7];

const encode = (source: CanvasImageSource, width: number, height: number, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return reject(new Error('Could not process the image'));
    // JPEG has no alpha: transparent pixels become white, never black.
    if (type === 'image/jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(source, 0, 0, width, height);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image'))), type, quality);
  });

const renamed = (name: string, type: string) =>
  `${name.replace(/\.[^.]+$/, '') || 'image'}.${type === 'image/png' ? 'png' : 'jpg'}`;

/**
 * Makes any picked, pasted or dropped image sendable: screenshots and other lossless images within
 * the limits travel untouched, so text stays crisp; photos are re-encoded (applying their EXIF
 * orientation) and anything larger than `MAX_IMAGE_EDGE` or `MAX_IMAGE_BYTES` is scaled down.
 */
export const prepareImage = async (file: File): Promise<PreparedImage> => {
  const source = await decodeImage(file);
  const naturalWidth = source.width;
  const naturalHeight = source.height;
  if (!naturalWidth || !naturalHeight) throw new Error('This image is empty');

  const reencode = async (scale: number): Promise<Blob | null> => {
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    if (file.type === 'image/png') {
      const png = await encode(source, width, height, 'image/png');
      if (png.size <= MAX_IMAGE_BYTES) return png;
    }
    for (const quality of JPEG_QUALITIES) {
      const jpeg = await encode(source, width, height, 'image/jpeg', quality);
      if (jpeg.size <= MAX_IMAGE_BYTES) return jpeg;
    }
    return null;
  };

  let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(naturalWidth, naturalHeight));
  const untouched = scale === 1 && LOSSLESS.includes(file.type) && file.size <= MAX_IMAGE_BYTES;
  let blob: Blob | null = untouched ? file : await reencode(scale);
  while (!blob) {
    scale *= 0.75;
    blob = await reencode(scale);
  }
  if ('close' in source) source.close();

  const mediaType = SENDABLE_IMAGE_TYPES.includes(blob.type) ? blob.type : 'image/jpeg';
  return {
    blob,
    upload: {
      mediaType,
      data: await blobToBase64(blob),
      name: untouched ? file.name || 'image' : renamed(file.name || 'image', mediaType),
      width: Math.max(1, Math.round(naturalWidth * scale)),
      height: Math.max(1, Math.round(naturalHeight * scale)),
    },
  };
};
