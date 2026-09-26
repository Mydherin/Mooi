import type { TranscriptBlock } from '@/features/sessions/types/TranscriptBlock';
import type { TurnResult } from '@/features/sessions/types/TurnResult';

/**
 * One row in the chat transcript. An `assistant` entry spans a whole agent turn — from the first
 * event after a user message to `turn.result` — not a single SDK message, so several internal
 * `AssistantMessage`s and tool calls render as one continuous, ordered set of `blocks`.
 */
export type TranscriptEntry =
  | { id: string; kind: 'user'; at: string; text: string }
  | { id: string; kind: 'assistant'; at: string; streaming: boolean; blocks: TranscriptBlock[]; result: TurnResult | null }
  | { id: string; kind: 'error'; at: string; text: string }
  | { id: string; kind: 'notice'; at: string; tone: 'success' | 'info'; title: string; text: string | null };
