import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_MESSAGE_IMAGES } from '@/features/sessions/lib/imageLimits';
import { prepareImage } from '@/features/sessions/lib/prepareImage';
import type { DraftImage } from '@/features/sessions/types/DraftImage';

const NOTICE_MS = 4000;
let sequence = 0;

/**
 * The images attached to a composer draft. Each one shows its preview at once and is prepared
 * (decoded, oriented, scaled, encoded) in the background; an image that cannot be read is dropped
 * with a short notice instead of blocking the message.
 */
export const useImageDraft = () => {
  const [images, setImages] = useState<DraftImage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const live = useRef(new Map<string, string>());

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const urls = live.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const release = (key: string) => {
    const url = live.current.get(key);
    if (url) URL.revokeObjectURL(url);
    live.current.delete(key);
  };

  const add = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const room = MAX_MESSAGE_IMAGES - live.current.size;
    if (files.length > room) setNotice(`A message can carry up to ${MAX_MESSAGE_IMAGES} images.`);
    const accepted = files.slice(0, Math.max(0, room)).map((file): DraftImage => {
      sequence += 1;
      const key = `draft-${sequence}`;
      const previewUrl = URL.createObjectURL(file);
      live.current.set(key, previewUrl);
      return { key, name: file.name || 'Pasted image', previewUrl, status: 'preparing', prepared: null, error: null };
    });
    if (accepted.length === 0) return;
    setImages((current) => [...current, ...accepted]);

    accepted.forEach((draft, index) => {
      prepareImage(files[index]).then((prepared) => {
        if (!live.current.has(draft.key)) return;
        // The prepared copy renders everywhere (a HEIC original only does on Apple browsers).
        release(draft.key);
        const previewUrl = URL.createObjectURL(prepared.blob);
        live.current.set(draft.key, previewUrl);
        setImages((current) => current.map((item) => item.key === draft.key
          ? { ...item, status: 'ready', prepared, previewUrl } : item));
      }).catch((failure: Error) => {
        if (!live.current.has(draft.key)) return;
        release(draft.key);
        setImages((current) => current.filter((item) => item.key !== draft.key));
        setNotice(`${draft.name}: ${failure.message || 'could not be read'}.`);
      });
    });
  }, []);

  const remove = useCallback((key: string) => {
    release(key);
    setImages((current) => current.filter((item) => item.key !== key));
  }, []);

  /** Drops exactly the images that were sent; anything attached meanwhile stays in the draft. */
  const discard = useCallback((keys: string[]) => {
    keys.forEach(release);
    setImages((current) => current.filter((item) => !keys.includes(item.key)));
  }, []);

  return {
    images,
    notice,
    preparing: images.some((image) => image.status === 'preparing'),
    full: images.length >= MAX_MESSAGE_IMAGES,
    add,
    remove,
    discard,
  };
};
