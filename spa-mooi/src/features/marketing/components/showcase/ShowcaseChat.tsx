import { FileDiff, FileCode, Terminal } from 'lucide-react';
import { LogoMark } from '@/shared/components/LogoMark';

export const ShowcaseChat = () => (
  <div className="flex min-h-0 flex-col gap-5 overflow-hidden border-line p-5 lg:border-r">
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl border border-line bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
        Rebuild the checkout so payment is the last step.
      </p>
    </div>

    <div className="flex gap-2.5">
      <LogoMark className="size-7 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-ink-muted">
          Reading the current flow, then moving the payment step.
        </p>

        <div className="mt-3 flex flex-col gap-1.5">
          <span className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-2.5 py-1.5 font-mono text-[11px] text-ink-subtle">
            <FileCode className="size-3.5 shrink-0 text-info" />
            <span className="truncate">CheckoutFlow.tsx</span>
          </span>
          <span className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-2.5 py-1.5 font-mono text-[11px] text-ink-subtle">
            <FileDiff className="size-3.5 shrink-0 text-success" />
            <span className="truncate">PaymentStep.tsx</span>
            <span className="ml-auto text-success">+96</span>
          </span>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2.5">
      <Terminal className="size-3.5 shrink-0 text-brand" />
      <span className="h-2 flex-1 animate-pulse-soft rounded-full bg-brand/30" />
      <span className="text-[11px] text-ink-subtle">Working…</span>
    </div>
  </div>
);
