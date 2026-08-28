const maskImage = 'radial-gradient(ellipse 60% 50% at 50% 0%, #000 35%, transparent 100%)';

export const HeroBackground = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          'linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        maskImage,
        WebkitMaskImage: maskImage,
      }}
    />
    <div className="absolute -top-40 left-1/2 size-[520px] -translate-x-3/4 animate-float-slow rounded-full bg-brand/25 blur-[140px]" />
    <div className="absolute -top-24 left-1/2 size-[420px] translate-x-1/4 animate-float-fast rounded-full bg-info/20 blur-[140px]" />
  </div>
);
