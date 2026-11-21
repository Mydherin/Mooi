import { Factory as FactoryIcon, FlaskConical, GitMerge, Hammer, Map as MapIcon, Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { Eyebrow } from '@/shared/components/Eyebrow';

const STEPS = [
  { icon: MapIcon, title: 'Define it together', text: 'Scope, base decisions and ordered phases, in a chat with an architect agent. Nothing runs until you approve.' },
  { icon: Hammer, title: 'It builds by itself', text: 'Each phase is expanded into milestones, built in fresh sessions that hand over at 20% of their context.' },
  { icon: FlaskConical, title: 'Tested end to end', text: 'Separate tester sessions run every milestone in its own preview; failures go back to the builders.' },
  { icon: GitMerge, title: 'Merged, phase by phase', text: 'Passed milestones are merged into the default branch. Pause, resume or change course at any time.' },
];

/** A project without a factory: what it does, and the button that opens its definition chat. */
export const FactoryIntro = ({ onEnable }: { onEnable: () => void }) => (
  <Card className="relative overflow-hidden p-6 sm:p-8">
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-dot-grid [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_65%)]" />
    <div className="relative flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Eyebrow>Software Factory</Eyebrow>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl">Build the whole project autonomously</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            For large projects: once you approve its definition, the factory builds it phase by phase and milestone by
            milestone, for days or weeks, with nobody connected. Everything it decides lives in <code className="font-mono text-[12.5px]">docs/factory/</code>.
          </p>
        </div>
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-brand shadow-raised sm:flex">
          <FactoryIcon className="size-5" />
        </span>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 rounded-control border border-line bg-surface-2/60 p-3.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">{title}</span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div>
        <Button variant="brand" size="lg" onClick={onEnable}><Sparkles className="size-4" />Define the factory</Button>
      </div>
    </div>
  </Card>
);
