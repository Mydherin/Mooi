import { useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { FactoryRunConfig } from '@/features/factory/types/FactoryRunConfig';
import { AgentModelFields } from '@/features/sessions/components/AgentModelFields';
import { useAgentModelChoice } from '@/features/sessions/hooks/useAgentModelChoice';
import { Button } from '@/shared/components/actions/Button';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';
import { Spinner } from '@/shared/components/feedback/Spinner';

interface FactoryRunDialogProps {
  title: string;
  description: string;
  action: string;
  connections: AgentConnection[];
  /** The previous run's agent, preselected; otherwise the account's and admin's defaults apply. */
  previous: FactoryRunConfig | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (run: FactoryRunConfig) => void;
}

/**
 * Chooses the agent every factory session runs with until the next pause (D9): asked at every start
 * and resume, preselected from the last run.
 */
export const FactoryRunDialog = ({ title, description, action, connections, previous, busy, error, onClose,
  onSubmit }: FactoryRunDialogProps) => {
  const choice = useAgentModelChoice(true, connections);
  // Restored in order, each once: the account, then its adapter (once the account's catalog names it),
  // then the model and effort that adapter offers.
  const restored = useRef({ connection: false, adapter: false, model: false });
  const { setConnectionId, setAdapter, selectModel, setEffort, selectedProvider } = choice;

  useEffect(() => {
    if (restored.current.connection || !previous || !connections.some((connection) => connection.id === previous.connectionId)) return;
    restored.current.connection = true;
    setConnectionId(previous.connectionId);
  }, [previous, connections, setConnectionId]);

  useEffect(() => {
    if (!previous || restored.current.model || !selectedProvider || choice.connectionId !== previous.connectionId) return;
    if (!restored.current.adapter) {
      restored.current.adapter = true;
      if (previous.adapter && selectedProvider.adapter !== previous.adapter
        && selectedProvider.adapters?.some((adapter) => adapter.id === previous.adapter)) {
        setAdapter(previous.adapter);
        return;
      }
    }
    restored.current.model = true;
    if (!previous.model || !selectedProvider.models.some((model) => model.id === previous.model)) return;
    selectModel(previous.model);
    if (previous.effort) setEffort(previous.effort);
  }, [previous, selectedProvider, choice.connectionId, setAdapter, selectModel, setEffort]);

  const submit = () => {
    if (!choice.ready || busy) return;
    onSubmit({ provider: choice.provider, connectionId: choice.connectionId, adapter: choice.adapter || null,
      model: choice.model, effort: choice.effort || null });
  };

  return <Dialog open size="lg" onClose={onClose} dismissible={!busy} title={title} description={description}
    footer={<>
      <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button variant="brand" onClick={submit} disabled={!choice.ready || busy}>
        {busy ? <Spinner className="size-4" /> : <Play className="size-4" />}
        {action}
      </Button>
    </>}>
    <div className="flex flex-col gap-5">
      <AgentModelFields choice={choice} onLeave={onClose} />
      <p className="rounded-control bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-ink-muted">
        Every session of the factory uses this agent until the next pause. Each session stops at 20% of its context and
        hands over to a fresh one.
      </p>
      {error ? <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p> : null}
    </div>
  </Dialog>;
};
