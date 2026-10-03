// Off the UI thread: Float32 mic samples (the AudioContext already resamples to 16 kHz) become
// PCM16 little-endian mono frames of 500 ms, transferred to the page without copying. On 'stop' the
// tail frame is flushed before answering 'stopped', so no spoken word is lost on release.
class DictationProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(8000);
    this.offset = 0;
    this.stopped = false;
    this.port.onmessage = ({ data }) => {
      if (data !== 'stop') return;
      this.stopped = true;
      if (this.offset) this.port.postMessage(this.buffer.slice(0, this.offset).buffer);
      this.port.postMessage('stopped');
    };
  }

  process(inputs) {
    if (this.stopped) return false;
    const samples = inputs[0]?.[0];
    if (!samples) return true;
    for (const value of samples) {
      const clamped = Math.max(-1, Math.min(1, value));
      this.buffer[this.offset++] = Math.round(clamped * (clamped < 0 ? 32768 : 32767));
      if (this.offset === this.buffer.length) {
        this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
        this.buffer = new Int16Array(8000);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor('dictation', DictationProcessor);
