import type { ChatMessage } from '@/features/sessions/types/ChatMessage';

export const chatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    author: 'You',
    time: '14:02',
    text: 'Rebuild the checkout so payment is the last step, and keep the address form as it is.',
  },
  {
    id: 'msg-2',
    role: 'agent',
    author: 'Mooi Agent',
    time: '14:02',
    text: 'Reading the current flow before touching anything.',
    steps: [
      {
        id: 'step-1',
        kind: 'read',
        target: 'src/features/checkout/CheckoutFlow.tsx',
        status: 'done',
        meta: '0.4s',
      },
      {
        id: 'step-2',
        kind: 'search',
        target: '"step" in src/features/checkout',
        status: 'done',
        meta: '3 matches',
      },
      {
        id: 'step-3',
        kind: 'read',
        target: 'src/features/checkout/steps/PaymentStep.tsx',
        status: 'done',
        meta: '0.3s',
      },
    ],
  },
  {
    id: 'msg-3',
    role: 'agent',
    author: 'Mooi Agent',
    time: '14:03',
    text: 'Payment now renders after review, and the legacy step is gone. Type-check passes.',
    steps: [
      {
        id: 'step-4',
        kind: 'edit',
        target: 'src/features/checkout/CheckoutFlow.tsx',
        status: 'done',
        added: 42,
        removed: 18,
      },
      {
        id: 'step-5',
        kind: 'create',
        target: 'src/features/checkout/steps/PaymentStep.tsx',
        status: 'done',
        added: 96,
      },
      {
        id: 'step-6',
        kind: 'run',
        target: 'bun run typecheck',
        status: 'done',
        meta: '8.1s',
      },
    ],
  },
  {
    id: 'msg-4',
    role: 'user',
    author: 'You',
    time: '14:05',
    text: 'Keep the progress bar in sync on mobile too.',
  },
  {
    id: 'msg-5',
    role: 'agent',
    author: 'Mooi Agent',
    time: '14:05',
    text: 'On it — updating the progress bar.',
    steps: [
      {
        id: 'step-7',
        kind: 'edit',
        target: 'src/features/checkout/ProgressBar.tsx',
        status: 'running',
      },
    ],
  },
];
