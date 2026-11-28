export type PlacementSide = 'top' | 'bottom';
export type PlacementAlign = 'start' | 'center' | 'end';
/** Preferred side and alignment; the side flips and the position shifts to stay on screen. */
export type Placement = `${PlacementSide}-${PlacementAlign}`;
