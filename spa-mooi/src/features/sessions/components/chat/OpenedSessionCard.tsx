import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, GitBranch, GitBranchPlus } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { SessionLiveStatus } from '@/features/sessions/components/SessionLiveStatus';
import type { OpenedSession } from '@/features/sessions/types/OpenedSession';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { cn } from '@/shared/utils/cn';
import { useSessionsStore } from '@/stores/sessionsStore';

interface OpenedSessionCardProps {
  /** The session whose agent opened it, the one this transcript belongs to. */
  sessionId: string;
  opened: OpenedSession;
}

/** Prompts longer than this start folded, so a long brief never buries the conversation. */
const FOLDED_PROMPT_LENGTH = 220;

/**
 * A session the agent opened, where it opened it: what it is for, its branch, its live state and
 * the brief it started with, one tap away from the session itself.
 */
export const OpenedSessionCard = ({ sessionId, opened }: OpenedSessionCardProps) => {
  const projectId = useSessionsStore((state) => state.sessions.find((session) => session.id === sessionId)?.projectId);
  const live = useSessionsStore((state) => state.sessions.find((session) => session.id === opened.sessionId));
  const foldable = opened.prompt.length > FOLDED_PROMPT_LENGTH || opened.prompt.split('\n').length > 3;
  const [expanded, setExpanded] = useState(false);
  const promptId = useId();
  const title = live?.title ?? opened.title;

  return (
    <article aria-label={`Opened session ${title ?? opened.branch}`}
      className="relative isolate w-full max-w-xl animate-fade-up overflow-hidden rounded-2xl border border-brand/20 bg-surface shadow-raised">
      <span aria-hidden className="absolute inset-x-0 top-0 -z-10 h-24 bg-[radial-gradient(120%_100%_at_0%_0%,var(--glow-a),transparent_70%)] opacity-70" />

      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand-soft text-brand">
          <GitBranchPlus aria-hidden className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-[11px] font-bold tracking-[0.04em] text-brand uppercase">Opened a new session</p>
            <SessionLiveStatus session={live} />
          </div>
          {title ? <h3 className="mt-1 text-[15px] leading-snug font-semibold tracking-[-0.01em] break-words text-ink">{title}</h3> : null}
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-ink-muted">
            <GitBranch aria-hidden className="size-3.5 shrink-0 text-ink-subtle" />
            <span className="truncate font-mono" title={opened.branch}>{opened.branch}</span>
          </p>
        </div>
      </div>

      {opened.prompt ? (
        <div className="mx-4 mt-3 rounded-xl border border-line bg-surface-2 sm:mx-5">
          <p id={promptId} className={cn('px-3.5 pt-3 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink-muted',
            foldable && !expanded ? 'line-clamp-3' : 'max-h-80 overflow-y-auto overscroll-contain', !foldable && 'pb-3')}>
            {opened.prompt}
          </p>
          {foldable ? (
            <button type="button" aria-expanded={expanded} aria-controls={promptId} onClick={() => setExpanded((value) => !value)}
              className="flex min-h-10 w-full items-center gap-1.5 rounded-b-xl px-3.5 text-[12px] font-semibold text-ink-subtle transition hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
              <ChevronDown aria-hidden className={cn('size-3.5 transition-transform duration-200', expanded && 'rotate-180')} />
              {expanded ? 'Show less' : 'Show the full prompt'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <p className="min-w-0 text-[12px] text-ink-subtle">
          {live ? 'Runs on its own branch and clone.' : 'This session is no longer live.'}
        </p>
        {projectId && live ? (
          <Link to={sessionPath(projectId, opened.sessionId)} className={cn(buttonStyles('secondary', 'sm'), 'shrink-0 gap-1.5')}>
            Open session
            <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </div>
    </article>
  );
};
