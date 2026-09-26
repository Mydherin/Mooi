import { TriangleAlert } from 'lucide-react';
import { EffortPicker } from '@/features/agents/components/EffortPicker';
import { ModelOptionList } from '@/features/agents/components/ModelOptionList';
import { modelChoiceIssue } from '@/features/agents/lib/modelChoiceIssue';
import { providerDefaultModel } from '@/features/agents/lib/providerDefaultModel';
import type { ModelChoice } from '@/features/agents/types/ModelChoice';
import type { ModelPurpose } from '@/features/agents/types/ModelPurpose';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';

interface ModelPurposeSectionProps {
  accountId: string;
  purpose: ModelPurpose;
  catalog: SessionProvider;
  choice: ModelChoice;
  onChange: (choice: ModelChoice) => void;
  disabled: boolean;
}

export const ModelPurposeSection = ({ accountId, purpose, catalog, choice, onChange, disabled }: ModelPurposeSectionProps) => {
  const Icon = purpose.icon;
  const model = choice.model ? catalog.models.find((entry) => entry.id === choice.model) : providerDefaultModel(catalog);
  const issue = modelChoiceIssue(choice, catalog);
  const headingId = `${accountId}-${purpose.id}-heading`;

  return <section aria-labelledby={headingId} className="grid gap-5 py-6 first:pt-0 last:pb-0 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-8">
    <header className="flex items-start gap-3 xl:flex-col">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-ink"><Icon className="size-5" /></span>
      <div className="min-w-0">
        <h4 id={headingId} className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">{purpose.label}</h4>
        <p className="mt-1 text-xs leading-relaxed text-ink-subtle">{purpose.description}</p>
      </div>
    </header>
    <div className="min-w-0 space-y-5">
      {issue && <div role="alert" className="flex gap-2.5 rounded-xl bg-warning-soft px-3.5 py-3 text-[13px] text-ink">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>{issue === 'model'
          ? <><b className="font-bold">{choice.model}</b> is no longer offered by this account. {purpose.missingFallback}</>
          : <><b className="font-bold capitalize">{choice.effort}</b> effort isn't supported by this model. Its default effort is used instead.</>}</p>
      </div>}
      <ModelOptionList name={`${accountId}-${purpose.id}-model`} label={`${purpose.label} model`} catalog={catalog}
        value={choice.model} disabled={disabled} onChange={(value) => onChange({ model: value, effort: '' })} />
      <EffortPicker name={`${accountId}-${purpose.id}-effort`} efforts={model?.efforts ?? []} modelDefault={model?.defaultEffort ?? null}
        value={choice.effort} disabled={disabled} onChange={(effort) => onChange({ ...choice, effort })} />
    </div>
  </section>;
};
