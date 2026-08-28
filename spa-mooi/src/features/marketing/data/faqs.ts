import type { FaqEntry } from '@/features/marketing/types/FaqEntry';

export const faqs: FaqEntry[] = [
  {
    id: 'push',
    question: 'Does Mooi push to my repository?',
    answer:
      'Only when you ask. A session works on its own branch and nothing reaches your default branch until you merge it.',
  },
  {
    id: 'providers',
    question: 'Which agent providers can I use?',
    answer:
      'Any provider you connect. The model is chosen per session and can be switched between runs.',
  },
  {
    id: 'preview',
    question: 'Where does the preview run?',
    answer:
      'Every session gets an isolated runtime. The preview frame points at that instance, not at production.',
  },
  {
    id: 'deploy',
    question: 'Can I deploy straight from a session?',
    answer:
      'Yes. Promote a session to any environment, with full deploy history and one-click rollback.',
  },
];
