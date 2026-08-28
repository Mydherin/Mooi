export const ShowcaseStage = () => (
  <div className="hidden min-h-0 flex-col bg-surface-2 lg:flex">
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-3">
      <span className="rounded-lg bg-surface px-3 py-1 text-[11px] font-medium text-ink shadow-sm">
        Preview
      </span>
      <span className="rounded-lg px-3 py-1 text-[11px] font-medium text-ink-subtle">Changes</span>
    </div>

    <div className="min-h-0 flex-1 p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
          <span className="size-4 rounded bg-gradient-to-br from-brand to-info" />
          <span className="text-[11px] font-semibold text-ink">Aurora</span>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[10px] text-ink-subtle">
              Address
            </span>
            <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[10px] text-ink-subtle">
              Review
            </span>
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-medium text-brand">
              Payment
            </span>
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl border border-line p-3">
            <span className="h-2.5 w-1/3 rounded-full bg-surface-3" />
            <span className="h-7 w-full rounded-lg bg-surface-2" />
            <span className="h-2.5 w-1/4 rounded-full bg-surface-3" />
            <span className="h-7 w-full rounded-lg bg-surface-2" />
            <span className="mt-1 flex items-center justify-between">
              <span className="h-2.5 w-16 rounded-full bg-surface-3" />
              <span className="h-2.5 w-12 rounded-full bg-surface-3" />
            </span>
          </div>

          <span className="h-8 w-full rounded-lg bg-brand" />
        </div>
      </div>
    </div>
  </div>
);
