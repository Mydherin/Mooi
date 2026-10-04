// Off the UI thread: Float32 mic samples at the device's native rate become PCM16 little-endian mono
// frames of 500 ms at 16 kHz, transferred to the page without copying. The context runs at the
// native rate on purpose: iOS can deliver silence when a context forces another rate onto the
// microphone, so the downsampling happens here (box-filter averaging, enough for speech). On 'stop'
// the tail frame is flushed before answering 'stopped', so no spoken word is lost on release.
const TARGET_RATE = 16000;

class DictationProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE;
    this.buffer = new Int16Array(TARGET_RATE / 2);
    this.offset = 0;
    this.sum = 0;
    this.count = 0;
    this.phase = 0;
    this.stopped = false;
    this.port.onmessage = ({ data }) => {
      if (data !== 'stop') return;
      this.stopped = true;
      if (this.offset) this.port.postMessage(this.buffer.slice(0, this.offset).buffer);
      this.port.postMessage('stopped');
    };
  }

  emit(value) {
    const clamped = Math.max(-1, Math.min(1, value));
    this.buffer[this.offset++] = Math.round(clamped * (clamped < 0 ? 32768 : 32767));
    if (this.offset === this.buffer.length) {
      this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
      this.buffer = new Int16Array(TARGET_RATE / 2);
      this.offset = 0;
    }
  }

  process(inputs) {
    if (this.stopped) return false;
    const samples = inputs[0]?.[0];
    if (!samples) return true;
    for (const value of samples) {
      this.sum += value;
      this.count += 1;
      this.phase += 1;
      if (this.phase < this.ratio) continue;
      const average = this.sum / this.count;
      while (this.phase >= this.ratio) {
        this.emit(average);
        this.phase -= this.ratio;
      }
      this.sum = 0;
      this.count = 0;
    }
    return true;
  }
}

registerProcessor('dictation', DictationProcessor);
