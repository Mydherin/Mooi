import { ImageOff } from 'lucide-react';
import { useSessionImageUrl } from '@/features/sessions/hooks/useSessionImageUrl';
import type { ImageAttachment } from '@/features/sessions/types/ImageAttachment';
import { cn } from '@/shared/utils/cn';

interface MessageImageTileProps {
  sessionId: string;
  image: ImageAttachment;
  /** A lone image keeps its own proportions; images in a grid are cropped to squares. */
  single: boolean;
  onOpen: () => void;
}

const ratio = (image: ImageAttachment) =>
  image.width && image.height ? Math.min(2.5, Math.max(0.5, image.width / image.height)) : 4 / 3;

export const MessageImageTile = ({ sessionId, image, single, onOpen }: MessageImageTileProps) => {
  const { url, failed } = useSessionImageUrl(sessionId, image.id);

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!url}
      aria-label={`Open ${image.name}`}
      title={image.name}
      // A lone image never grows past the tile width nor a viewport-bound height, keeping its ratio.
      style={single ? { aspectRatio: ratio(image), width: `min(100%, var(--tile), calc(min(20rem, 45dvh) * ${ratio(image)}))` } : undefined}
      className={cn(
        'group relative block overflow-hidden rounded-2xl border border-line bg-surface-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand enabled:cursor-zoom-in',
        single ? '[--tile:18rem] sm:[--tile:22rem]' : 'aspect-square w-full',
      )}
    >
      {/* Pinned to the tile's box: a percentage height inside a <button> sized only by its aspect
          ratio does not resolve in every engine, which left the picture overflowing the tile. */}
      {url ? (
        <img src={url} alt={image.name} draggable={false} decoding="async"
          className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
      ) : failed ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-xs text-ink-subtle">
          <ImageOff aria-hidden="true" className="size-5" />
          Unavailable
        </span>
      ) : (
        <span aria-hidden="true" className="absolute inset-0 animate-pulse-soft bg-surface-3" />
      )}
    </button>
  );
};
