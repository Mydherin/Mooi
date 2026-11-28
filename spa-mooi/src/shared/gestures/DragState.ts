export type DragAxis = 'x' | 'y';

export interface DragState {
  /** Movement since the press, in px (positive right / down). */
  dx: number;
  dy: number;
  /** Velocity of the last 100 ms, in px/ms. */
  vx: number;
  vy: number;
  /** The axis the gesture locked to once it passed the threshold. */
  axis: DragAxis;
  pointerType: string;
  /** The press target, e.g. to find the scroller it started in. */
  target: EventTarget | null;
}
