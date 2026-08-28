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

export const Avatar = ({ src, name, size = 'md' }: AvatarProps) => {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn('shrink-0 rounded-full object-cover', sizes[size])}
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
