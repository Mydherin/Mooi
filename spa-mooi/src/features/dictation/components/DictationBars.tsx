const BAR_HEIGHTS = [8, 14, 10, 14, 8];

/** Compact live-recording meter; it only moves when the user accepts motion. */
export const DictationBars = () => (
  <span aria-hidden="true" className="flex h-4 items-center gap-[2px]">
    {BAR_HEIGHTS.map((height, index) => (
      <span
        key={index}
        className="w-[2.5px] origin-center rounded-full bg-current motion-safe:animate-voice-bar"
        style={{ height, animationDelay: `${index * 150}ms` }}
      />
    ))}
  </span>
);
