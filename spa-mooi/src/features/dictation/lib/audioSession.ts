type AudioSessionType = 'auto' | 'play-and-record';

interface AudioSessionNavigator {
  audioSession?: { type: string };
}

/**
 * Tells iOS (Safari 16.4+ Audio Session API) the page records, so the microphone is routed into
 * Web Audio instead of a playback-only session that delivers silence. It is kept for the page life,
 * like the shared dictation engine: switching it back and forth can leave a later context silent.
 * No-op elsewhere.
 */
export const setAudioSessionType = (type: AudioSessionType): void => {
  const session = (navigator as Navigator & AudioSessionNavigator).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // An engine that refuses the type keeps its default routing.
  }
};
