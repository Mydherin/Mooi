import { sessionsFetch } from '@/features/sessions/lib/sessionsFetch';
import type { AgentTrace } from '@/features/traces/types/AgentTrace';
import type { TraceSpanDetail } from '@/features/traces/types/TraceSpanDetail';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

const tracePath = (sessionId: string, revision?: string) =>
  `/sessions/${sessionId}/trace${revision ? `?revision=${encodeURIComponent(revision)}` : ''}`;
const spanPath = (sessionId: string, spanId: string) =>
  `/sessions/${sessionId}/trace/spans/${encodeURIComponent(spanId)}`;

/** The session's trace, or `null` when it has not changed since `revision` (`204`). */
export const fetchTrace = async (sessionId: string, revision?: string): Promise<AgentTrace | null> => {
  const response = await sessionsFetch(tracePath(sessionId, revision));

  if (response.status === 204) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Could not load the trace.'));
  }

  return (await response.json()) as AgentTrace;
};

export const fetchTraceSpan = async (sessionId: string, spanId: string): Promise<TraceSpanDetail> => {
  const response = await sessionsFetch(spanPath(sessionId, spanId));

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Could not load this step.'));
  }

  return (await response.json()) as TraceSpanDetail;
};
