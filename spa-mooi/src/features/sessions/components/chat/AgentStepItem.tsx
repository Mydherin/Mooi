import { useState } from 'react';
import { Check, ChevronDown, CircleAlert, LoaderCircle } from 'lucide-react';
import { summarizeCommand } from '@/features/sessions/lib/summarizeCommand';
import { toolCategory, toolFilePath, toolIcon } from '@/features/sessions/lib/toolIcon';
import type { TranscriptStep } from '@/features/sessions/types/TranscriptStep';
import { cn } from '@/shared/utils/cn';

interface AgentStepItemProps {
  step: TranscriptStep;
}

/**
 * One `tool.use` step and, once `tool.result` lands, its outcome. The result summary is bounded
 * server-side, so it is safe to render in full — but it stays folded until asked for, because a
 * turn can carry a dozen steps and the transcript is the reading surface, not the log.
 */
export const AgentStepItem = ({ step }: AgentStepItemProps) => {
  const [open, setOpen] = useState(false);
  const Icon = toolIcon(step.name);
  const command = step.name === 'Bash' ? summarizeCommand(step.input.command) : null;
  const category = command?.category ?? toolCategory(step.name, step.status);
  const filePath = toolFilePath(step);
  const title = command ? command.detail : filePath?.split(/[/\\]/).filter(Boolean).pop() || step.title;
  const summary = step.summary?.trim() ?? '';
  const expandable = Object.keys(step.input).length > 0 || summary.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2/60">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        className="flex w-full items-center gap-2.5 min-h-11 px-3 py-2 text-left transition enabled:hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand disabled:cursor-default"
      >
        <Icon className="size-3.5 shrink-0 text-ink-subtle" />

        <span title={command ? undefined : filePath ?? step.title} className="min-w-0 flex-1 truncate text-xs text-ink-muted">
          <span className={cn('mr-2 font-semibold', step.status === 'failed' ? 'text-danger' : 'text-ink-subtle')}>{category}</span>
          <span className="font-mono">{title}</span>
        </span>

        {step.status === 'running' ? (
          <LoaderCircle className="size-3.5 shrink-0 animate-spin text-info" />
        ) : null}
        {step.status === 'done' ? <Check className="size-3.5 shrink-0 text-success" /> : null}
        {step.status === 'failed' ? <CircleAlert className="size-3.5 shrink-0 text-danger" /> : null}

        {expandable ? (
          <ChevronDown
            className={cn('size-3.5 shrink-0 text-ink-subtle transition', open ? 'rotate-180' : null)}
          />
        ) : null}
      </button>

      {expandable && open ? (
        <pre
          className={cn(
            'max-h-64 overflow-auto border-t border-line px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words',
            step.status === 'failed' ? 'text-danger' : 'text-ink-subtle',
          )}
        >
          {`Input\n${JSON.stringify(step.input, null, 2)}${summary ? `\n\nOutput\n${summary}` : ''}`}
        </pre>
      ) : null}
    </div>
  );
};
