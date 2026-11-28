/**
 * iOS-style resistance past an edge: the further the drag, the less the content follows, never
 * beyond `dimension`. `constant` 0.55 is UIScrollView's.
 */
export const rubberBand = (overshoot: number, dimension: number, constant = 0.55): number => {
  if (dimension <= 0) return 0;
  const sign = Math.sign(overshoot);
  const distance = Math.abs(overshoot);
  return sign * (1 - 1 / ((distance * constant) / dimension + 1)) * dimension;
};
