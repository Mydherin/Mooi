import { useState } from 'react';
import { ImageLightbox } from './ImageLightbox';
import { MessageImageTile } from './MessageImageTile';
import type { ImageAttachment } from '@/features/sessions/types/ImageAttachment';
import { cn } from '@/shared/utils/cn';

interface MessageImageGridProps {
  sessionId: string;
  images: ImageAttachment[];
  /** User messages sit on the right; agent output reads from the left. */
  align?: 'start' | 'end';
}

/** The images of one message; any of them opens the viewer. */
export const MessageImageGrid = ({ sessionId, images, align = 'end' }: MessageImageGridProps) => {
  const [open, setOpen] = useState<number | null>(null);
  const single = images.length === 1;

  return (
    <>
      <div className={cn(single ? cn('flex w-full max-w-[85%]', align === 'end' ? 'justify-end' : 'justify-start') : 'grid w-[min(20rem,85%)] gap-1.5 sm:w-[min(24rem,85%)]',
        images.length === 2 || images.length === 4 ? 'grid-cols-2' : 'grid-cols-3')}>
        {images.map((image, index) => (
          <MessageImageTile key={image.id} sessionId={sessionId} image={image} single={single} onOpen={() => setOpen(index)} />
        ))}
      </div>
      {open !== null ? <ImageLightbox sessionId={sessionId} images={images} index={open} onIndexChange={setOpen}
        onClose={() => setOpen(null)} /> : null}
    </>
  );
};
