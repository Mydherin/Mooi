import { lazy, Suspense, useState } from 'react';
import { Brain, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const MarkdownContent = lazy(() => import('./MarkdownContent'));

interface ThinkingBlockProps {
  text: string;
}

/**
 * Reasoning is an optional capability, never assumed: this only ever renders for a session whose
 * provider declares `thinking`. Folded by default — it is context, not the answer.
 */
export const ThinkingBlock = ({ text }: ThinkingBlockProps) => {
  const [open, setOpen] = useState(false);

  if (!text.trim()) return null;

  return (
    <div className="rounded-xl border-l-2 border-line bg-surface-2/30">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink-subtle transition hover:text-ink-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      >
        <Brain className="size-3.5 shrink-0" />
        <span className="flex-1 font-medium">Thinking</span>
        <ChevronDown className={cn('size-3.5 shrink-0 transition', open ? 'rotate-180' : null)} />
      </button>

      {open ? (
        <div className="max-h-80 overflow-auto px-4 pb-4 text-sm leading-7 text-ink-muted">
          <Suspense fallback={<p className="whitespace-pre-wrap">{text}</p>}>
            <MarkdownContent text={text} />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
};
