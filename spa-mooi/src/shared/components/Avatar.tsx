import { useEffect, useState } from 'react';
import { cn } from '@/shared/utils/cn';

interface AvatarProps {
  src: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-16 text-xl',
};

/**
 * A picture when there is one, the initial when there is not — and the initial again when the
 * picture cannot be loaded.
 *
 * `referrerPolicy` is what makes Google profile pictures work: `lh3.googleusercontent.com` refuses
 * requests that carry a cross-origin referrer, which is why the avatar broke on the first sign-in
 * and appeared to heal later, once the browser had the image cached from Google's own frame.
 */
export const Avatar = ({ src, name, size = 'md' }: AvatarProps) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full bg-surface-2 object-cover', sizes[size])}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand',
        sizes[size],
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
};
