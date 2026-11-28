import { SlidersHorizontal } from 'lucide-react';
import { SelectField } from '@/shared/components/forms/select/SelectField';
import type { SelectOption } from '@/shared/components/forms/select/SelectOption';
import { Popover } from '@/shared/components/overlays/popover/Popover';
import { keepCurrentOption } from '@/features/sessions/lib/keepCurrentOption';
import { cn } from '@/shared/utils/cn';

interface ComposerModelMenuProps {
  model: string;
  effort: string | null;
  modelOptions: SelectOption[];
  effortOptions: SelectOption[];
  onModelChange: (value: string) => void;
  onEffortChange: (value: string) => void;
  disabled: boolean;
}

/** Phones fold the model and effort pickers into one chip so the toolbar keeps a single tidy row. */
export const ComposerModelMenu = ({ model, effort, modelOptions, effortOptions, onModelChange, onEffortChange, disabled }: ComposerModelMenuProps) => {
  const modelLabel = modelOptions.find((option) => option.value === model)?.label ?? model;
  const summary = effort ? `${modelLabel} · ${effort}` : modelLabel;

  return (
    <Popover label="Model and effort" placement="top-start" className="w-80"
      renderTrigger={(props) => (
        <button {...props} type="button" aria-label={`Model and effort: ${summary}`}
          className={cn('flex h-9 min-w-0 items-center gap-1.5 rounded-full border px-3 text-caption font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            props['aria-expanded'] ? 'border-ink bg-surface text-ink' : 'border-line bg-surface text-ink-muted hover-device:hover:text-ink')}>
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{summary}</span>
        </button>
      )}
      content={(
        <div className="flex flex-col gap-3">
          <SelectField label="Model" value={model || null} options={keepCurrentOption(modelOptions, model)} onChange={onModelChange} disabled={disabled} />
          {effortOptions.length > 0 ? (
            <SelectField label="Effort" value={effort || null} options={keepCurrentOption(effortOptions, effort ?? '')} onChange={onEffortChange} disabled={disabled} />
          ) : null}
        </div>
      )} />
  );
};
