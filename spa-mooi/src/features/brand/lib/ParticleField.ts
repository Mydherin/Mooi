import { drawOrbit } from '@/features/brand/lib/drawOrbit';
import { drawParticles } from '@/features/brand/lib/drawParticles';
import { createDust, drawDust } from '@/features/brand/lib/dustLayer';
import { MORPH_WAVE_MS, STAGE_DURATION_MS } from '@/features/brand/lib/pipelineTiming';
import { sampleShape } from '@/features/brand/lib/sampleShape';
import { drawShockwaves } from '@/features/brand/lib/shockwaves';
import { stepParticle } from '@/features/brand/lib/stepParticle';
import type { FieldPalette } from '@/features/brand/types/FieldPalette';
import type { FieldPointer } from '@/features/brand/types/FieldPointer';
import type { Particle } from '@/features/brand/types/Particle';
import type { PipelineStage } from '@/features/brand/types/PipelineStage';
import type { ShapePoint } from '@/features/brand/types/ShapePoint';
import type { Shockwave } from '@/features/brand/types/Shockwave';
import type { StageLayout } from '@/features/brand/types/StageLayout';

const PARTICLE_COUNT = 1300;
const DUST_COUNT = 70;
const BURST_REACH = 260;
const BURST_FORCE = 18;
/** Frames longer than this (tab switch, jank) are not simulated in one leap. */
const MAX_DT = 3;

/**
 * A canvas of particles that tells the Mooi loop: they gather into each stage shape, hold it, and
 * are released into a swirling current that carries them into the next one. Owns the clock, the
 * stage sequence and the render loop; physics and drawing live in their own modules.
 *
 * With `still` (reduced motion) nothing animates: the field snaps to a shape and renders once.
 */
export class ParticleField {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly onStage: (stage: number) => void;
  private readonly still: boolean;
  private readonly shapes: ShapePoint[][];
  private readonly launches: boolean[];
  private readonly dust = createDust(DUST_COUNT);
  private particles: Particle[] = [];
  private waves: Shockwave[] = [];
  private layout: StageLayout = { width: 0, height: 0, cx: 0, cy: 0, radius: 0, dpr: 1 };
  private palette: FieldPalette = { ink: '#ffffff', accent: '#276ef1' };
  private pointer: FieldPointer = { x: 0, y: 0, active: false };
  private stage: number;
  private stageStart = 0;
  private last = 0;
  private frame = 0;
  private running = false;
  private visible = true;

  constructor(canvas: HTMLCanvasElement, stages: PipelineStage[], onStage: (stage: number) => void, still: boolean) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onStage = onStage;
    this.still = still;
    this.shapes = stages.map((stage) => sampleShape(stage.draw, PARTICLE_COUNT));
    this.launches = stages.map((stage) => Boolean(stage.launches));
    this.stage = still ? stages.length - 1 : 0;
  }

  start() {
    this.running = true;
    this.refreshPalette();
    this.onStage(this.stage);
    this.schedule();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.schedule();
  }

  resize(layout: StageLayout) {
    this.layout = layout;
    this.canvas.width = Math.round(layout.width * layout.dpr);
    this.canvas.height = Math.round(layout.height * layout.dpr);
    if (this.particles.length === 0 && layout.width > 0) this.seed();
    if (this.still) this.renderStill();
  }

  /** Colors come from CSS (the canvas `color` and `--brand-vivid`), so the field follows the theme. */
  refreshPalette() {
    const style = getComputedStyle(this.canvas);
    this.palette = {
      ink: style.color || this.palette.ink,
      accent: style.getPropertyValue('--brand-vivid').trim() || this.palette.accent,
    };
    if (this.still) this.renderStill();
  }

  goTo(stage: number) {
    this.stage = stage;
    this.stageStart = performance.now();
    this.onStage(stage);
    if (this.still) this.renderStill();
  }

  point(clientX: number, clientY: number) {
    const bounds = this.canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    this.pointer = { x, y, active: x >= 0 && y >= 0 && x <= bounds.width && y <= bounds.height };
  }

  release() {
    this.pointer = { ...this.pointer, active: false };
  }

  /** A shockwave from the pointer: nearby particles are flung away and spring back into shape. */
  burst(clientX: number, clientY: number) {
    if (this.still) return;
    const bounds = this.canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    this.waves.push({ x, y, born: performance.now() });
    for (const p of this.particles) {
      const dx = p.x - x;
      const dy = p.y - y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > BURST_REACH) continue;
      const force = (1 - distance / BURST_REACH) * BURST_FORCE * (0.6 + Math.random() * 0.8);
      p.vx += (dx / distance) * force;
      p.vy += (dy / distance) * force;
    }
  }

  private schedule() {
    if (!this.running || this.still || !this.visible || this.frame) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number) => {
    this.frame = 0;
    if (!this.running || !this.visible) return;
    const dt = this.last ? Math.min(MAX_DT, (now - this.last) / (1000 / 60)) : 1;
    this.last = now;

    if (this.particles.length > 0) {
      if (now - this.stageStart >= STAGE_DURATION_MS) this.goTo((this.stage + 1) % this.shapes.length);
      const frame = {
        now,
        dt,
        stage: this.stage,
        stageStart: this.stageStart,
        shapes: this.shapes,
        launches: this.launches,
        layout: this.layout,
        pointer: this.pointer,
      };
      for (const p of this.particles) stepParticle(p, frame);
      this.render(now, dt, (now - this.stageStart) / STAGE_DURATION_MS);
    }
    this.schedule();
  };

  /** The opening: every particle leaves the center at once and finds its place in the first shape. */
  private seed() {
    const { cx, cy } = this.layout;
    this.particles = Array.from({ length: PARTICLE_COUNT }, (_, slot) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 18;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        slot,
        stage: this.stage,
        delay: (slot / PARTICLE_COUNT) * MORPH_WAVE_MS + Math.random() * 180,
        phase: Math.random() * Math.PI * 2,
        tier: Math.floor(Math.random() * 3),
        accent: false,
      };
    });
    this.stageStart = performance.now();
  }

  private renderStill() {
    if (this.shapes[this.stage].length === 0) return;
    const { cx, cy, radius } = this.layout;
    for (const p of this.particles) {
      const point = this.shapes[this.stage][p.slot];
      p.x = cx + point.x * radius;
      p.y = cy + point.y * radius;
      p.vx = 0;
      p.vy = 0;
      p.stage = this.stage;
      p.accent = point.accent;
    }
    this.render(performance.now(), 0, 1);
  }

  private render(now: number, dt: number, progress: number) {
    const { ctx, layout } = this;
    if (!ctx) return;
    ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
    ctx.clearRect(0, 0, layout.width, layout.height);
    drawDust(ctx, this.dust, layout, this.pointer, this.palette, dt);
    drawOrbit(ctx, layout, this.palette, Math.min(1, progress), now);
    drawParticles(ctx, this.particles, this.palette);
    this.waves = drawShockwaves(ctx, this.waves, this.palette, now);
  }
}
