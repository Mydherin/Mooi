export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Index into every sampled shape: the same slot is followed from shape to shape. */
  slot: number;
  /** The stage whose shape the particle currently follows; lags the field by `delay`. */
  stage: number;
  /** Milliseconds the particle waits before answering a stage change, so morphs sweep as a wave. */
  delay: number;
  phase: number;
  /** Depth layer, 0 (far) to 2 (near): drives thickness and opacity. */
  tier: number;
  accent: boolean;
}
