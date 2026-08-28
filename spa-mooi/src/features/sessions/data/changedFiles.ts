import type { ChangedFile } from '@/features/sessions/types/ChangedFile';

export const changedFiles: ChangedFile[] = [
  {
    id: 'checkout-flow',
    path: 'src/features/checkout/CheckoutFlow.tsx',
    kind: 'modified',
    added: 42,
    removed: 18,
  },
  {
    id: 'payment-step',
    path: 'src/features/checkout/steps/PaymentStep.tsx',
    kind: 'added',
    added: 96,
    removed: 0,
  },
  {
    id: 'review-step',
    path: 'src/features/checkout/steps/ReviewStep.tsx',
    kind: 'modified',
    added: 18,
    removed: 6,
  },
  {
    id: 'progress-bar',
    path: 'src/features/checkout/ProgressBar.tsx',
    kind: 'modified',
    added: 12,
    removed: 4,
  },
  {
    id: 'legacy-payment-step',
    path: 'src/features/checkout/steps/LegacyPaymentStep.tsx',
    kind: 'deleted',
    added: 0,
    removed: 64,
  },
  {
    id: 'checkout-css',
    path: 'src/styles/checkout.css',
    kind: 'modified',
    added: 8,
    removed: 2,
  },
];

export const changedFilesSummary = {
  files: 6,
  added: 176,
  removed: 94,
};
