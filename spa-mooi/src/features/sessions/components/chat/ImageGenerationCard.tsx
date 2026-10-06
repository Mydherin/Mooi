import { useState } from 'react';
import { CircleAlert, ImageOff, Sparkles } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';
import { useSessionImageUrl } from '@/features/sessions/hooks/useSessionImageUrl';
import type { ImageAttachment } from '@/features/sessions/types/ImageAttachment';
import type { TranscriptStep } from '@/features/sessions/types/TranscriptStep';

interface ImageGenerationCardProps {
  sessionId: string;
  step: TranscriptStep;
}

const frame = 'relative w-full overflow-hidden rounded-2xl border border-line bg-surface-2';

const ratio = (image: ImageAttachment) =>
  image.width && image.height ? Math.min(2.5, Math.max(0.5, image.width / image.height)) : 1;

const prompt = (step: TranscriptStep) => {
  const value = step.input.prompt;
  return typeof value === 'string' && value.trim() ? value : null;
};

/** The provider streams no partial frames, so a running generation is a live placeholder. */
const GeneratingPreview = ({ text }: { text: string | null }) => (
  <div role="status" className={`${frame} aspect-square max-h-[min(28rem,60dvh)]`}>
    <div aria-hidden="true" className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_25%,color-mix(in_oklab,var(--color-brand)_16%,transparent)_50%,transparent_75%)] bg-[length:200%_100%]" />
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Sparkles aria-hidden="true" className="size-5 animate-pulse-soft" />
      </span>
      <span className="text-sm font-semibold text-ink">Generating image…</span>
      {text ? <span className="line-clamp-3 max-w-sm text-xs leading-relaxed text-ink-subtle">{text}</span> : null}
    </div>
  </div>
);

const GeneratedImage = ({ sessionId, image }: { sessionId: string; image: ImageAttachment }) => {
  const { url, failed } = useSessionImageUrl(sessionId, image.id);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!url}
        aria-label={`Open ${image.name}`}
        title={image.name}
        style={{ aspectRatio: ratio(image), maxWidth: `calc(min(28rem, 60dvh) * ${ratio(image)})` }}
        className={`${frame} group block enabled:cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
      >
        {url ? (
          <img src={url} alt={image.name} draggable={false} decoding="async"
            className="absolute inset-0 size-full animate-menu-in object-cover transition duration-300 group-hover:scale-[1.02]" />
        ) : failed ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-ink-subtle">
            <ImageOff aria-hidden="true" className="size-5" />
            Unavailable
          </span>
        ) : (
          <span aria-hidden="true" className="absolute inset-0 animate-pulse-soft bg-surface-3" />
        )}
      </button>
      {open ? <ImageLightbox sessionId={sessionId} images={[image]} index={0} onIndexChange={() => undefined}
        onClose={() => setOpen(false)} /> : null}
    </>
  );
};

/** A native image generation, from its placeholder to the generated picture or its failure. */
export const ImageGenerationCard = ({ sessionId, step }: ImageGenerationCardProps) => {
  const text = prompt(step);
  if (step.status === 'running') return <GeneratingPreview text={text} />;
  const image = step.images[0];

  if (step.status === 'failed' || !image) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft px-3.5 py-2.5 text-sm leading-relaxed text-danger">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 flex-1 break-words">{step.summary || 'The image could not be generated.'}</span>
      </div>
    );
  }

  return (
    <figure className="flex w-full max-w-md flex-col gap-1.5">
      <GeneratedImage sessionId={sessionId} image={image} />
      {text ? <figcaption className="line-clamp-2 px-1 text-xs leading-relaxed text-ink-subtle" title={text}>{text}</figcaption> : null}
    </figure>
  );
};
