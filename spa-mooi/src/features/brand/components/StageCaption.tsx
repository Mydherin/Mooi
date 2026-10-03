import { useTypewriter } from '@/features/brand/hooks/useTypewriter';

interface StageCaptionProps {
  text: string;
}

/** The terminal-like line under the steps, typed out for each stage. */
export const StageCaption = ({ text }: StageCaptionProps) => {
  const typed = useTypewriter(text);

  return (
    <p aria-hidden className="relative z-10 mt-5 flex h-5 items-center font-mono text-xs text-contrast-ink/70">
      {typed}
      <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse-soft rounded-[1px] bg-brand-vivid" />
    </p>
  );
};
