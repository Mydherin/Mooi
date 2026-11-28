import { Spinner } from '@/shared/components/feedback/Spinner';

/** While the provider's sign-in is being opened. */
export const PairingPreparing = () => (
  <p role="status" className="flex items-center justify-center gap-2.5 rounded-control bg-surface-2 px-4 py-6 text-callout text-ink-muted">
    <Spinner /> Preparing secure sign-in…
  </p>
);
