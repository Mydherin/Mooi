import { LoaderCircle, X } from 'lucide-react';
import type { DraftImage } from '@/features/sessions/types/DraftImage';

interface ComposerImageStripProps {
  images: DraftImage[];
  onRemove: (key: string) => void;
}

/** The draft's attached images as a sideways-scrolling row of thumbnails above the text. */
export const ComposerImageStrip = ({ images, onRemove }: ComposerImageStripProps) => (
  <ul aria-label="Attached images" className="flex gap-2.5 overflow-x-auto px-3 pt-3 pb-1 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
    {images.map((image) => (
      <li key={image.key} className="relative shrink-0 animate-menu-in pt-1.5 pr-1.5">
        <img
          src={image.previewUrl}
          alt={image.name}
          title={image.name}
          draggable={false}
          className="size-16 rounded-xl border border-line bg-surface-3 object-cover sm:size-[4.5rem]"
        />
        {image.status === 'preparing' ? (
          <span role="status" aria-label={`Preparing ${image.name}`}
            className="absolute inset-0 top-1.5 right-1.5 flex items-center justify-center rounded-xl bg-black/35 text-white">
            <LoaderCircle aria-hidden="true" className="size-4.5 animate-spin" />
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onRemove(image.key)}
          aria-label={`Remove ${image.name}`}
          title="Remove image"
          className="absolute top-0 right-0 inline-flex size-6 items-center justify-center rounded-full bg-contrast text-contrast-ink shadow-md ring-2 ring-surface-2 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-95 max-sm:after:absolute max-sm:after:-inset-2.5"
        >
          <X aria-hidden="true" className="size-3.5" strokeWidth={2.75} />
        </button>
      </li>
    ))}
  </ul>
);
