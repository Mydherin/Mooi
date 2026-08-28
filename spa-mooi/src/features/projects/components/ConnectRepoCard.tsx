import { Plus } from 'lucide-react';

export const ConnectRepoCard = () => (
  <button
    type="button"
    className="flex h-full min-h-[190px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line p-5 text-center transition hover:border-line-strong hover:bg-surface-2/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
  >
    <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
      <Plus className="size-5" />
    </span>
    <span className="mt-4 text-sm font-semibold text-ink">Connect a GitHub repository</span>
    <span className="mt-1.5 max-w-[260px] text-sm leading-relaxed text-ink-muted">
      Import an existing repo and start your first session.
    </span>
  </button>
);
