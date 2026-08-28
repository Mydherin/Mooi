export const ThinkingIndicator = () => (
  <span className="flex items-center gap-2 px-1 text-xs text-ink-subtle">
    <span className="flex items-center gap-1">
      {[0, 200, 400].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-pulse-soft rounded-full bg-brand"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
    Working…
  </span>
);
