import { DICTATION_MESSAGES } from '@/features/dictation/lib/dictationMessages';
import { dictationStreamUrl } from '@/features/dictation/lib/dictationStreamUrl';
import type { DictationCallbacks } from '@/features/dictation/types/DictationCallbacks';
import type { DictationServerMessage } from '@/features/dictation/types/DictationServerMessage';
import { microphoneErrorMessage } from '@/features/dictation/lib/microphoneErrorMessage';

const SAMPLE_RATE = 16000;
const CONNECT_TIMEOUT_MS = 15_000;
const FINALIZE_TIMEOUT_MS = 30_000;
/** iOS keeps `resume()` pending forever while its audio session is interrupted: never wait longer. */
const AUDIO_START_TIMEOUT_MS = 5_000;
/** ~4 s of PCM16 at 16 kHz queued unsent: the link cannot keep up with real time. */
const MAX_BUFFERED_BYTES = 128_000;
const WORKLET_URL = `${import.meta.env.BASE_URL}dictation-worklet.js`;

/**
 * One dictation: microphone → AudioWorklet (PCM16, 16 kHz, 500 ms frames) → WebSocket to
 * mic-speech, and the running transcript back. The microphone is requested first, inside the user
 * gesture, before any server session exists. Every exit path releases every resource, and once
 * disposed no callback fires again. Audio start is bounded in time, so a browser that never lets
 * the audio run (iOS audio interruption, missing user activation) ends in an error, never a hang.
 */
export class DictationSession {
  private readonly callbacks: DictationCallbacks;
  private closed = false;
  private stopping = false;
  private ready = false;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private socket: WebSocket | null = null;
  private timer: number | undefined;

  constructor(callbacks: DictationCallbacks) {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fail(DICTATION_MESSAGES.insecureContext);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      if (this.closed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
    } catch (error) {
      this.fail(microphoneErrorMessage(error));
      return;
    }
    this.stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => this.fail(DICTATION_MESSAGES.microphoneDisconnected)));

    try {
      // The browser resamples the microphone to 16 kHz: no client resampling code.
      this.context = new AudioContext({ sampleRate: SAMPLE_RATE });
    } catch {
      this.fail(DICTATION_MESSAGES.sampleRateUnsupported);
      return;
    }
    if (this.context.sampleRate !== SAMPLE_RATE) {
      this.fail(DICTATION_MESSAGES.sampleRateUnsupported);
      return;
    }
    try {
      await this.context.audioWorklet.addModule(WORKLET_URL);
      if (this.closed) return;
      await this.startAudio(this.context);
      if (this.closed) return;
    } catch {
      this.fail(DICTATION_MESSAGES.audioBlocked);
      return;
    }
    this.context.addEventListener('statechange', this.onAudioStateChange);

    this.open();
  }

  /**
   * Resumes the audio engine; call it from a user activation (`pointerup`, `click`, `keydown`).
   * Touch `pointerdown` is not an activation, so the engine may still be waiting for one.
   */
  resumeAudio(): void {
    if (this.closed || !this.context || this.context.state === 'running') return;
    void this.context.resume().catch(() => undefined);
  }

  /** Idempotent. Before `ready` it is deferred; after, the worklet flushes its tail frame first. */
  stop(): void {
    if (this.closed || this.stopping) return;
    this.stopping = true;
    if (!this.ready) return;
    this.callbacks.onStopping();
    this.arm(FINALIZE_TIMEOUT_MS, DICTATION_MESSAGES.finalizeTimeout);
    this.node?.port.postMessage('stop');
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.timer);
    this.stopTracks();
    this.source?.disconnect();
    if (this.node) {
      this.node.port.onmessage = null;
      this.node.port.close();
      this.node.disconnect();
    }
    this.context?.removeEventListener('statechange', this.onAudioStateChange);
    void this.context?.close().catch(() => undefined);
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
  }

  private async startAudio(context: AudioContext): Promise<void> {
    if (context.state === 'running') return;
    let timer: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('audio start timeout')), AUDIO_START_TIMEOUT_MS);
    });
    try {
      await Promise.race([context.resume(), timeout]);
    } finally {
      window.clearTimeout(timer);
    }
    if ((context.state as string) !== 'running') throw new Error('audio not running');
  }

  /** A phone call, Siri or another app takes the audio away (`interrupted` on iOS): recover or end. */
  private readonly onAudioStateChange = (): void => {
    const context = this.context;
    if (this.closed || !context || context.state === 'running') return;
    if (context.state === 'closed') {
      this.fail(DICTATION_MESSAGES.microphoneDisconnected);
      return;
    }
    void this.startAudio(context).catch(() => this.fail(DICTATION_MESSAGES.microphoneDisconnected));
  };

  private open(): void {
    const socket = new WebSocket(dictationStreamUrl());
    this.socket = socket;
    this.arm(CONNECT_TIMEOUT_MS, DICTATION_MESSAGES.connectTimeout);
    socket.onmessage = (event) => this.receive(event.data);
    socket.onerror = () => this.fail(this.ready ? DICTATION_MESSAGES.connectionInterrupted : DICTATION_MESSAGES.connectFailed);
    socket.onclose = () => this.fail(this.ready ? DICTATION_MESSAGES.connectionInterrupted : DICTATION_MESSAGES.connectFailed);
  }

  private receive(data: unknown): void {
    if (this.closed) return;
    let message: DictationServerMessage;
    try {
      message = JSON.parse(String(data)) as DictationServerMessage;
    } catch {
      this.fail(DICTATION_MESSAGES.invalidResponse);
      return;
    }
    switch (message.type) {
      case 'ready':
        this.onReady(message.maxSeconds);
        return;
      case 'partial':
        this.callbacks.onPartial(message.text);
        return;
      case 'final':
        this.dispose();
        this.callbacks.onFinal(message.text);
        return;
      case 'error':
        this.fail(message.message);
        return;
      default:
        this.fail(DICTATION_MESSAGES.invalidResponse);
    }
  }

  private onReady(maxSeconds: number): void {
    const { context, stream } = this;
    if (!context || !stream) return;
    window.clearTimeout(this.timer);
    try {
      this.source = context.createMediaStreamSource(stream);
      this.node = new AudioWorkletNode(context, 'dictation', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
      });
      this.node.port.onmessage = ({ data }) => this.onFrame(data);
      // The worklet outputs silence; reaching the destination only keeps it processing.
      this.source.connect(this.node).connect(context.destination);
    } catch {
      // Some engines refuse a microphone stream whose native rate differs from the context's.
      this.fail(DICTATION_MESSAGES.sampleRateUnsupported);
      return;
    }
    this.ready = true;
    this.callbacks.onReady();
    if (this.stopping) {
      this.stopping = false;
      this.stop();
      return;
    }
    this.timer = window.setTimeout(() => this.stop(), maxSeconds * 1000);
  }

  private onFrame(data: unknown): void {
    const socket = this.socket;
    if (this.closed || !socket) return;
    if (data === 'stopped') {
      this.source?.disconnect();
      this.stopTracks();
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }));
      return;
    }
    if (!(data instanceof ArrayBuffer) || socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.fail(DICTATION_MESSAGES.backpressure);
      return;
    }
    socket.send(data);
  }

  private arm(delay: number, message: string): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.fail(message), delay);
  }

  private stopTracks(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
  }

  private fail(message: string): void {
    if (this.closed) return;
    this.dispose();
    this.callbacks.onError(message);
  }
}
