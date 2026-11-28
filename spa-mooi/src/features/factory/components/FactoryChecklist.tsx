import { CircleAlert, CircleCheck, CircleDashed, ExternalLink } from 'lucide-react';
import { factoryDocumentUrl } from '@/features/factory/lib/factoryDocumentUrl';
import type { FactoryIssue } from '@/features/factory/types/FactoryIssue';
import type { FactoryPlan } from '@/features/factory/types/FactoryPlan';
import { Eyebrow } from '@/shared/components/data-display/Eyebrow';

const CORE = ['FACTORY.md', 'VISION.md', 'ARCHITECTURE.md', 'DECISIONS.md', 'ROADMAP.md'];

interface FactoryChecklistProps {
  plan: FactoryPlan | null;
  /** What the last approval attempt reported, when it was refused. */
  issues: FactoryIssue[];
  fullName: string;
  branch: string;
}

/** The definition as published on the default branch: core documents, phases, and what still blocks approval. */
export const FactoryChecklist = ({ plan, issues, fullName, branch }: FactoryChecklistProps) => {
  const reported = issues.length > 0 ? issues : plan?.issues ?? [];
  const phases = plan?.phases ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Eyebrow>Core documents</Eyebrow>
        <ul className="mt-2 flex flex-col gap-1">
          {CORE.map((file) => {
            const present = Boolean(plan?.core?.[file]);
            return (
              <li key={file} className="flex min-w-0 items-center gap-2 text-footnote">
                {present ? <CircleCheck className="size-4 shrink-0 text-success" /> : <CircleDashed className="size-4 shrink-0 text-ink-subtle" />}
                {present ? (
                  <a href={factoryDocumentUrl(fullName, branch, file)} target="_blank" rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 font-mono text-mono text-ink transition hover-device:hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">
                    <span className="truncate">{file}</span><ExternalLink className="size-3 shrink-0" />
                  </a>
                ) : <span className="truncate font-mono text-mono text-ink-subtle">{file}</span>}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <Eyebrow>Phases</Eyebrow>
        {phases.length > 0 ? (
          <ol className="mt-2 flex flex-col gap-1">
            {phases.map((phase) => (
              <li key={phase.id} className="flex min-w-0 items-baseline gap-2 text-footnote text-ink">
                <span className="shrink-0 font-mono text-mono text-ink-subtle">{phase.id.slice(0, 2)}</span>
                <span className="truncate">{phase.title}</span>
              </li>
            ))}
          </ol>
        ) : <p className="mt-2 text-footnote text-ink-subtle">No roadmap published yet.</p>}
      </div>

      {reported.length > 0 ? (
        <div role="status" className="rounded-control border border-warning/30 bg-warning-soft px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-footnote font-semibold text-warning"><CircleAlert className="size-3.5" />Still to fix before approving</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {reported.slice(0, 12).map((issue) => (
              <li key={`${issue.path}:${issue.message}`} className="text-caption leading-relaxed text-ink-muted">
                <span className="font-mono text-mono text-ink">{issue.path.replace(/^docs\/factory\//, '')}</span> · {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
