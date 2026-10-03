/**
 * The direction of a slow swirling current at a point and time. Layered sines are not true curl
 * noise, but they read as turbulence and cost a handful of flops per particle.
 */
export const flowAngle = (x: number, y: number, time: number): number =>
  Math.sin(x * 0.009 + time * 0.0006) * 2.1 +
  Math.cos(y * 0.011 - time * 0.0005) * 2.1 +
  Math.sin((x + y) * 0.004 + time * 0.0003) * 1.3;
