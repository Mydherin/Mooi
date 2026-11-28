import type { AgentQuestion } from '@/features/sessions/types/AgentQuestion';
import type { SessionPendingRequest } from '@/features/sessions/types/SessionPendingRequest';

/** What the agent is blocked on, read from `permission.request` / `question.request` payloads. */

type Data = Record<string, unknown>;

export const permissionRequest = (data: Data): SessionPendingRequest => ({
  kind: 'permission',
  requestId: String(data.requestId),
  toolName: String(data.toolName),
  title: String(data.title ?? data.toolName),
  input: (data.input as Record<string, unknown> | undefined) ?? {},
});

export const questionRequest = (data: Data): SessionPendingRequest => ({
  kind: 'question',
  requestId: String(data.requestId),
  questions: (data.questions as AgentQuestion[] | undefined) ?? [],
});

/** A request replaces any earlier copy of itself (a replayed event), so the list never duplicates it. */
export const withPendingRequest = (pending: SessionPendingRequest[], request: SessionPendingRequest): SessionPendingRequest[] =>
  [...pending.filter((item) => item.requestId !== request.requestId), request];

/** The transcript line that records a request: the approval title, or the questions asked. */
export const requestText = (data: Data, kind: 'permission' | 'question'): string => kind === 'permission'
  ? `Approval requested: ${String(data.title ?? data.toolName)}`
  : ((data.questions as AgentQuestion[] | undefined) ?? []).map((question) => question.question).join('\n');

/** The transcript line that records how a request was resolved: each answer, or the decision. */
export const resolutionText = (data: Data): string => data.answers
  ? Object.entries(data.answers as Record<string, string | string[]>)
    .map(([question, answer]) => `**${question}**\n\n${Array.isArray(answer) ? answer.join(', ') : answer}`).join('\n\n')
  : `Decision: ${String(data.decision ?? 'resolved')}`;
