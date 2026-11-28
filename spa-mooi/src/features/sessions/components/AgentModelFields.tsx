import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { AgentAccountSelect } from '@/features/agents/components/AgentAccountSelect';
import { AgentAdapterSelect } from '@/features/sessions/components/AgentAdapterSelect';
import { SessionModelFields } from '@/features/sessions/components/SessionModelFields';
import type { AgentModelChoice } from '@/features/sessions/hooks/useAgentModelChoice';
import { Alert } from '@/shared/components/feedback/Alert';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { buttonStyles } from '@/shared/styles/buttonStyles';

interface AgentModelFieldsProps {
  choice: AgentModelChoice;
  /** Called when the user follows the link to add an agent account. */
  onLeave: () => void;
}

/** Agent account, adapter, model and effort pickers, or the way to add an account when there is none. */
export const AgentModelFields = ({ choice, onLeave }: AgentModelFieldsProps) => {
  const { connections, connectionId, setConnectionId, adapters, adapter, setAdapter, selectedProvider, model, effort,
    selectModel, setEffort, catalogError } = choice;

  if (connections.length === 0) {
    return (
      <Alert tone="warning" title="Add an agent account first"
        action={<Link to={`${ROUTES.account}?tab=agents`} onClick={onLeave} className={buttonStyles('secondary', 'sm')}>Add account</Link>}>
        A session needs a Claude or Codex account to run.
      </Alert>
    );
  }

  const defaultUnavailable = selectedProvider && !selectedProvider.unavailable && !selectedProvider.defaultModel
    && selectedProvider.models.length > 0 && !model;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <AgentAccountSelect connections={connections} value={connectionId} onChange={setConnectionId} />
      {adapters.length > 1 ? <AgentAdapterSelect adapters={adapters} value={adapter} onChange={setAdapter} /> : null}
      <SessionModelFields provider={selectedProvider} model={model} effort={effort}
        onModelChange={selectModel} onEffortChange={setEffort} />
      {defaultUnavailable ? <Alert tone="warning">The configured default model is unavailable. Select a model to continue.</Alert> : null}
      {catalogError ? <Alert tone="danger">{catalogError}</Alert>
        : !selectedProvider ? <p role="status" className="flex items-center gap-2 text-footnote text-ink-muted"><Spinner /> Loading models…</p> : null}
    </div>
  );
};
