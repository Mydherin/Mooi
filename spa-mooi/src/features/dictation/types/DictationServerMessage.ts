export type DictationServerMessage =
  | { type: 'ready'; sampleRate: number; maxSeconds: number }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'error'; message: string };
