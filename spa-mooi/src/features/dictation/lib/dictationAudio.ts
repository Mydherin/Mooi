const WORKLET_URL = `${import.meta.env.BASE_URL}dictation-worklet.js`;

interface Engine {
  context: AudioContext;
  worklet: Promise<void>;
  users: number;
}

let engine: Engine | null = null;

/**
 * The page's single dictation audio engine: one AudioContext with the worklet loaded, shared by
 * every dictation and only suspended between them. iOS (WebKit) can feed silence into a context
 * created after another one was closed in the same page, so contexts are not recreated per
 * dictation. `discard` drops a misbehaving engine: the next dictation builds a fresh one, exactly
 * as after a page reload.
 */
export const acquireDictationAudio = async (): Promise<AudioContext> => {
  if (!engine || engine.context.state === 'closed') {
    // Native rate, matching the microphone: the worklet downsamples to 16 kHz itself.
    const context = new AudioContext({ latencyHint: 'interactive' });
    engine = { context, worklet: context.audioWorklet.addModule(WORKLET_URL), users: 0 };
  }
  const current = engine;
  current.users += 1;
  try {
    await current.worklet;
  } catch (error) {
    discardDictationAudio(current.context);
    throw error;
  }
  return current.context;
};

/** The dictation is over: the engine idles (suspended) until the next one. */
export const releaseDictationAudio = (context: AudioContext): void => {
  if (engine?.context !== context) return;
  engine.users = Math.max(0, engine.users - 1);
  if (engine.users === 0 && context.state !== 'closed') void context.suspend().catch(() => undefined);
};

/** The engine produced no usable audio: close it so the next dictation starts from scratch. */
export const discardDictationAudio = (context: AudioContext): void => {
  if (engine?.context === context) engine = null;
  if (context.state !== 'closed') void context.close().catch(() => undefined);
};
