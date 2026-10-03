/** A background speck in unit canvas space; `depth` scales its parallax against the pointer. */
export interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  depth: number;
}
