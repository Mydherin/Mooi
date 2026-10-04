interface Point {
  x: number;
  y: number;
}

export interface PreviewZoom {
  setViewport: (element: HTMLDivElement | null) => void;
  setContent: (element: HTMLDivElement | null) => void;
  scale: number;
  /** Multiplies the scale keeping the content under `anchor` (client coordinates) in place. */
  zoomBy: (factor: number, anchor?: Point) => void;
  panBy: (dx: number, dy: number) => void;
  fit: () => void;
}
