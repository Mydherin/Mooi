import type { TranscriptEntry } from '@/features/sessions/types/TranscriptEntry';

/** System milestones in the transcript (compaction, merges, handovers...): rows of their own, never chat. */

type NoticeEntry = Extract<TranscriptEntry, { kind: 'notice' }>;

const notice = (id: string, at: string, tone: NoticeEntry['tone'], title: string, text: string | null): NoticeEntry =>
  ({ id, kind: 'notice', at, tone, title, text });

export const clearedNotice = (seq: number, at: string): NoticeEntry =>
  notice(`cleared-${seq}`, at, 'info', 'Conversation cleared', 'The agent starts a fresh conversation for the next task.');

const COMPACTION = {
  started: ['progress', 'Compacting context…', 'Earlier messages stay visible while the agent condenses its context.'],
  completed: ['success', 'Context compacted', 'The agent now continues with a concise summary of earlier messages.'],
  failed: ['info', 'Compaction failed', 'The earlier context is still available to the agent.'],
} as const;

export const compactionNotice = (seq: number, at: string, phase: string): NoticeEntry => {
  const [tone, title, text] = COMPACTION[phase === 'started' || phase === 'completed' ? phase : 'failed'];
  return notice(`compaction-${seq}`, at, tone, title, text);
};

/** A finished compaction settles the spinner of the one that started it. */
export const settleProgressNotices = (entries: TranscriptEntry[]): TranscriptEntry[] =>
  entries.some((entry) => entry.kind === 'notice' && entry.tone === 'progress')
    ? entries.map((entry) => entry.kind === 'notice' && entry.tone === 'progress' ? { ...entry, tone: 'info' as const } : entry)
    : entries;

export const mergeNotice = (seq: number, at: string, targetBranch: string, commit: string, message: string | null): NoticeEntry =>
  notice(`merge-${seq}`, at, 'success', `Merged into ${targetBranch} · ${commit.slice(0, 7)}`, message);

/** `agent.activity` kinds that the transcript shows as a notice, with the id prefix and title of each. */
const ACTIVITY_NOTICES: Record<string, [string, string]> = {
  context_handover: ['handover', 'Context handover'],
  limits_resumed: ['limits', 'Usage limits renewed'],
  merge_conflicts: ['conflicts', 'Merge conflicts'],
};

export const activityNotice = (seq: number, at: string, kind: string, description: string | null): NoticeEntry | null => {
  const known = ACTIVITY_NOTICES[kind];
  return known ? notice(`${known[0]}-${seq}`, at, 'info', known[1], description) : null;
};
