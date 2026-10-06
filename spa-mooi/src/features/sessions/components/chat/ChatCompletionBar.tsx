import type { ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';

interface ChatCompletionBarProps {
  title: string;
  description: string;
  /** False for a plain ready notice without the success check. */
  done?: boolean;
  children: ReactNode;
}

/**
 * The strip above a chat that tells the user its job is done and offers what comes next. Always one
 * line: phones get smaller print and a compact action, and the text truncates (full text on hover).
 */
export const ChatCompletionBar = ({ title, description, done = true, children }: ChatCompletionBarProps) => (
  <div role="status" className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-success-soft/60 py-1.5 pr-2 pl-3 sm:gap-3 sm:px-5 sm:py-2.5">
    <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-bold text-ink sm:gap-2 sm:text-sm" title={`${title} ${description}`}>
      {done ? <CircleCheck className="size-3.5 shrink-0 text-success-dot sm:size-4" /> : null}
      <span className="min-w-0 truncate">{title} <span className="font-medium text-ink-muted">{description}</span></span>
    </p>
    <div className="flex shrink-0 items-center gap-2 max-sm:*:h-8 max-sm:*:gap-1.5 max-sm:*:px-2.5 max-sm:*:text-[12px]">{children}</div>
  </div>
);
