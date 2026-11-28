import type { SessionProvider } from '@/features/sessions/types/SessionProvider';
import { Alert } from '@/shared/components/feedback/Alert';
import { SelectField } from '@/shared/components/forms/select/SelectField';

interface SessionModelFieldsProps {
  provider?: SessionProvider;
  model: string;
  effort: string;
  onModelChange: (value: string) => void;
  onEffortChange: (value: string) => void;
}

/** Model and reasoning effort from the provider's catalog; effort only when the model offers several. */
export const SessionModelFields = ({ provider, model, effort, onModelChange, onEffortChange }: SessionModelFieldsProps) => {
  if (!provider) return null;
  if (provider.unavailable) return <Alert tone="danger">{provider.unavailable}</Alert>;
  const efforts = provider.models.find((entry) => entry.id === model)?.efforts ?? [];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <SelectField label="Model" value={model || null} onChange={onModelChange} placeholder="Select a model"
        fieldClassName={efforts.length === 0 ? 'sm:col-span-2' : undefined}
        options={provider.models.map((entry) => ({ value: entry.id, label: entry.label, keywords: entry.id }))} />
      {efforts.length > 0 ? (
        <SelectField label="Effort" value={effort || null} onChange={onEffortChange}
          options={efforts.map((entry) => ({ value: entry, label: entry.charAt(0).toUpperCase() + entry.slice(1) }))} />
      ) : null}
    </div>
  );
};
