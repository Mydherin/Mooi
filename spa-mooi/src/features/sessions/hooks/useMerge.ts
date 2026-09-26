import { useCallback, useEffect, useRef, useState } from 'react';
import { checkMerge, mergeSession, resolveMergeConflicts } from '@/features/sessions/api/sessionsApi';
import type { MergePhase } from '@/features/sessions/types/MergePhase';
import type { MergeResult } from '@/features/sessions/types/MergeResult';
import { useSessionsStore } from '@/stores/sessionsStore';

const UP_TO_DATE_MS = 5000;

const errorMessage = (failure: unknown, fallback: string) => failure instanceof Error ? failure.message : fallback;

/**
 * The merge control's request flow. An outcome tied to the workspace (a conflict, a fresh merge)
 * stays valid only until the workspace changes again: any later `changes.updated` returns the
 * control to `idle`, since the agent (or the player) may have already reconciled the branches, and
 * a finished merge is then read from the transcript's `lastMerge` instead.
 */
export const useMerge = (sessionId: string) => {
  const changesSeq = useSessionsStore((state) => state.byId[sessionId]?.changesEventSeq ?? 0);
  const [phase, setPhase] = useState<MergePhase>('idle');
  const [result, setResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outcomeSeq = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    if ((phase === 'conflicts' || phase === 'merged') && changesSeq > outcomeSeq.current) {
      setPhase('idle');
      setResult(null);
    }
  }, [phase, changesSeq]);

  useEffect(() => {
    if (phase !== 'up_to_date') return;
    const timer = window.setTimeout(() => setPhase('idle'), UP_TO_DATE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const settle = useCallback((outcome: MergeResult) => {
    setResult(outcome);
    outcomeSeq.current = useSessionsStore.getState().byId[sessionId]?.changesEventSeq ?? 0;
    setPhase(outcome.state === 'clean' ? 'ready' : outcome.state);
  }, [sessionId]);

  const guard = useCallback(async (next: MergePhase, fallback: MergePhase, message: string, run: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPhase(next);
    setError(null);
    try {
      await run();
    } catch (failure) {
      setError(errorMessage(failure, message));
      setPhase(fallback);
    } finally {
      busy.current = false;
    }
  }, []);

  const check = () => guard('checking', 'idle', 'Could not check the merge.',
    async () => settle(await checkMerge(sessionId)));

  const commit = (message: string) => guard('merging', 'ready', 'Could not merge this session.',
    async () => settle(await mergeSession(sessionId, message)));

  const resolve = () => guard('resolving', 'conflicts', 'Could not start resolving the conflicts.', async () => {
    await resolveMergeConflicts(sessionId);
    useSessionsStore.getState().setPane(sessionId, 'conversation');
    setResult(null);
    setPhase('idle');
  });

  const cancel = () => {
    if (busy.current) return;
    setError(null);
    setPhase('idle');
  };

  return { phase, result, error, check, commit, resolve, cancel };
};
