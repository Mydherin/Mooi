import type { ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';

interface ChatCompletionBarProps {
  title: string;
  description: string;
  /** False for a plain ready notice without the success check. */
  done?: boolean;
  children: ReactNode;
}

/** The strip above a chat that tells the user its job is done and offers what comes next. */
export const ChatCompletionBar = ({ title, description, done = true, children }: ChatCompletionBarProps) => (
  <div role="status" className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-success-soft/60 px-4 py-2.5 sm:px-5">
    <p className="flex items-center gap-2 text-sm font-bold text-ink">
      {done ? <CircleCheck className="size-4 shrink-0 text-success-dot" /> : null}
      {title} <span className="font-medium text-ink-muted">{description}</span>
    </p>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);
