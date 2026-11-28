interface Sample {
  time: number;
  x: number;
  y: number;
}

const WINDOW_MS = 100;

/** Release velocity from the last 100 ms of movement, in px/ms: what a fling "means". */
export const createVelocityTracker = () => {
  const samples: Sample[] = [];

  return {
    add(x: number, y: number, time = performance.now()): void {
      samples.push({ time, x, y });
      while (samples.length > 2 && time - (samples[0]?.time ?? time) > WINDOW_MS) samples.shift();
    },
    velocity(): { vx: number; vy: number } {
      const first = samples[0];
      const last = samples.at(-1);
      if (!first || !last || last.time === first.time) return { vx: 0, vy: 0 };
      const elapsed = last.time - first.time;
      return { vx: (last.x - first.x) / elapsed, vy: (last.y - first.y) / elapsed };
    },
    reset(): void {
      samples.length = 0;
    },
  };
};
