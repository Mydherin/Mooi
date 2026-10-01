import { useCallback, useEffect, useState } from 'react';
import { applyPlatformSnapshot, applyPlatformStreamEvent } from '@/features/platform/lib/applyPlatformStreamEvent';
import type { PlatformSnapshot } from '@/features/platform/types/PlatformSnapshot';
import type { PlatformStreamState } from '@/features/platform/types/PlatformStreamState';
import { openEventStream, type EventStreamState } from '@/features/sessions/lib/openEventStream';

interface UsePlatformStream<S> extends PlatformStreamState<S> {
  streamState: EventStreamState;
  /** Bumps whenever the configuration or its environment changes on the server. */
  configurationRevision: number;
  adoptSnapshot: (snapshot: S) => void;
}

/**
 * Live operation state and console output of one project's platform stream (`path`, events named
 * `<prefix>.*`), kept for as long as the page is open.
 */
export const usePlatformStream = <S extends PlatformSnapshot>(path: string | undefined, prefix: string): UsePlatformStream<S> => {
  const empty: PlatformStreamState<S> = { snapshot: null, logs: [] };
  const [state, setState] = useState<{ path?: string } & PlatformStreamState<S>>({ path, ...empty });
  const [streamState, setStreamState] = useState<EventStreamState>('closed');
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const current = state.path === path ? state : { path, ...empty };

  useEffect(() => {
    if (!path) return;
    return openEventStream({
      path,
      after: 0,
      onFrame: (frame) => {
        setState((previous) => ({ path, ...applyPlatformStreamEvent<S>(prefix, previous.path === path ? previous : { snapshot: null, logs: [] }, frame) }));
        if (frame.type === `${prefix}.configuration`) setConfigurationRevision((value) => value + 1);
      },
      onState: setStreamState,
    });
  }, [path, prefix]);

  const adoptSnapshot = useCallback((snapshot: S) => setState((previous) =>
    ({ path, ...applyPlatformSnapshot(previous.path === path ? previous : { snapshot: null, logs: [] }, snapshot) })), [path]);

  return { snapshot: current.snapshot, logs: current.logs, streamState, configurationRevision, adoptSnapshot };
};
