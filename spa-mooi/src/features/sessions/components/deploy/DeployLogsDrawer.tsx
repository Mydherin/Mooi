import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useOnEscape } from '@/shared/hooks/useOnEscape';
import { useSessionsStore } from '@/stores/sessionsStore';
import { DeployTerminal } from './DeployTerminal';

export const DeployLogsDrawer = ({ sessionId }: { sessionId: string }) => {
  const transcript = useSessionsStore((state) => state.byId[sessionId]);
  const deployment = useSessionsStore((state) => state.sessions.find((session) => session.id === sessionId)?.deployment);
  const panel = useRef<HTMLElement>(null);
  const close = () => useSessionsStore.getState().setDeploymentLogsOpen(sessionId, false);
  const operationId = deployment?.operationId ?? transcript?.deploymentActivityOperationId ?? null;
  const activity = transcript?.deploymentActivityOperationId === operationId ? transcript.deploymentActivity : [];
  const truncated = activity.some((item) => item.title === 'Activity log truncated') || (activity[0]?.index ?? 0) > 0;

  useOnEscape(close);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('[data-close-logs]')?.focus();
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) focusable()[0]?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocus);
      previousFocus?.focus();
    };
  }, []);

  return <div className="fixed inset-0 z-50" aria-label="Deployment logs overlay">
    <button type="button" tabIndex={-1} aria-label="Close deployment logs" onClick={close}
      className="absolute inset-0 size-full bg-black/55 backdrop-blur-[2px]" />
    <aside ref={panel} id="deployment-logs-drawer" role="dialog" aria-modal="true" aria-label="Deployment logs"
      className="absolute inset-y-0 right-0 flex h-full w-full flex-col border-l border-neutral-800 bg-neutral-950 shadow-2xl sm:w-[min(720px,92vw)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-3 text-neutral-100">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Deployment logs</h2>
          <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-[11px] text-neutral-400" aria-live="polite" aria-atomic="true">
            <span className="capitalize">{deployment?.state ?? 'idle'}</span>
            {deployment?.phase ? <span>{deployment.phase}</span> : null}
            {operationId ? <span title={operationId}>{operationId.slice(0, 8)}</span> : null}
            <span>{activity.length} entries{truncated ? ' · truncated' : ''}</span>
          </p>
        </div>
        <button data-close-logs type="button" aria-label="Close deployment logs" title="Close deployment logs" onClick={close}
          className="inline-flex size-9 items-center justify-center rounded-md text-neutral-300 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"><X className="size-4" /></button>
      </header>
      <DeployTerminal activity={activity} operationId={operationId} />
    </aside>
  </div>;
};
