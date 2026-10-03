export interface DictationCallbacks {
  onReady: () => void;
  onPartial: (text: string) => void;
  onStopping: () => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}
