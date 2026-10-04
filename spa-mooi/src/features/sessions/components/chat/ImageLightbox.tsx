import { useEffect, useRef, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useSessionImageUrl } from '@/features/sessions/hooks/useSessionImageUrl';
import type { ImageAttachment } from '@/features/sessions/types/ImageAttachment';
import { useLockBodyScroll } from '@/shared/hooks/useLockBodyScroll';
import { cn } from '@/shared/utils/cn';

interface ImageLightboxProps {
  sessionId: string;
  images: ImageAttachment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const SWIPE_PX = 50;
const control = 'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95';

const Picture = ({ sessionId, image }: { sessionId: string; image: ImageAttachment }) => {
  const { url, failed } = useSessionImageUrl(sessionId, image.id);
  if (failed) return <p className="text-sm text-white/70">This image is no longer available.</p>;
  if (!url) return <span aria-hidden="true" className="size-10 animate-spin rounded-full border-2 border-white/25 border-t-white" />;
  return <img src={url} alt={image.name} draggable={false}
    className="max-h-full max-w-full animate-menu-in rounded-lg object-contain shadow-2xl select-none" />;
};

/**
 * Full-screen image viewer in the top layer (a modal `<dialog>`, like `Modal`): Escape or the
 * backdrop closes it, arrow keys and swipes move between the message's images.
 */
export const ImageLightbox = ({ sessionId, images, index, onIndexChange, onClose }: ImageLightboxProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  const image = images[index];
  const many = images.length > 1;
  const { url } = useSessionImageUrl(sessionId, image.id);
  useLockBodyScroll(true);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    element.focus({ preventScroll: true });
    return () => {
      element.close();
      trigger?.focus({ preventScroll: true });
    };
  }, []);

  const step = (delta: number) => onIndexChange((index + delta + images.length) % images.length);

  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (start === null || !many) return;
    const distance = event.changedTouches[0].clientX - start;
    if (Math.abs(distance) > SWIPE_PX) step(distance < 0 ? 1 : -1);
  };

  return createPortal(
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-label={image.name}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (!many) return;
        if (event.key === 'ArrowRight') step(1);
        if (event.key === 'ArrowLeft') step(-1);
      }}
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
      onTouchEnd={onTouchEnd}
      className="fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none flex-col bg-black/90 p-0 text-white outline-none backdrop:bg-transparent"
    >
      <header className="flex shrink-0 items-center gap-3 px-3 pt-[calc(var(--safe-top)+0.75rem)] pb-2 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {image.name}
          {many ? <span className="ml-2 font-normal text-white/60">{index + 1} / {images.length}</span> : null}
        </p>
        {url ? (
          <a href={url} download={image.name} aria-label="Download image" title="Download image" className={control}>
            <Download aria-hidden="true" className="size-4.5" />
          </a>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Close image" title="Close" className={control}>
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>

      <div
        className={cn('relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-20 sm:pb-[calc(var(--safe-bottom)+1.5rem)]',
          many ? 'pb-4' : 'pb-[calc(var(--safe-bottom)+1rem)]')}
        onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      >
        <Picture key={image.id} sessionId={sessionId} image={image} />
        {many ? (
          <>
            <button type="button" onClick={() => step(-1)} aria-label="Previous image" title="Previous"
              className={cn(control, 'absolute left-3 max-sm:hidden sm:left-5')}>
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next image" title="Next"
              className={cn(control, 'absolute right-3 max-sm:hidden sm:right-5')}>
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {many ? (
        <nav aria-label="Images" className="flex shrink-0 justify-center gap-1.5 pb-[calc(var(--safe-bottom)+1rem)] sm:hidden">
          {images.map((item, position) => (
            <button key={item.id} type="button" onClick={() => onIndexChange(position)} aria-label={`Image ${position + 1}`}
              aria-current={position === index}
              className={cn('relative h-1.5 rounded-full transition-all after:absolute after:-inset-3', position === index ? 'w-5 bg-white' : 'w-1.5 bg-white/40')} />
          ))}
        </nav>
      ) : null}
    </dialog>, document.body,
  );
};
