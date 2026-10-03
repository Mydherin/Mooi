import { flowAngle } from '@/features/brand/lib/flowField';
import { STAGE_MORPH_MS } from '@/features/brand/lib/pipelineTiming';
import type { FieldFrame } from '@/features/brand/types/FieldFrame';
import type { Particle } from '@/features/brand/types/Particle';

const POINTER_REACH = 120;
const POINTER_FORCE = 2.6;
/** Tangential share of the pointer force: the cursor stirs a vortex rather than only pushing. */
const POINTER_SWIRL = 0.9;
const TURBULENCE = 1.25;
const DAMPING = 0.84;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Releases a particle from its old shape: a burst outwards, or a launch upwards after "ship". */
const release = (p: Particle, frame: FieldFrame) => {
  if (frame.launches[p.stage]) {
    p.vy -= 12 + Math.random() * 14;
    p.vx += (Math.random() - 0.5) * 4;
    return;
  }
  const dx = p.x - frame.layout.cx;
  const dy = p.y - frame.layout.cy;
  const distance = Math.hypot(dx, dy) || 1;
  const kick = 3 + Math.random() * 5;
  p.vx += (dx / distance) * kick;
  p.vy += (dy / distance) * kick;
};

/**
 * One physics step: a spring towards the particle's slot in the current shape, whose stiffness
 * ramps up as the morph settles, a swirling current that peaks mid-morph, and the pointer vortex.
 */
export const stepParticle = (p: Particle, frame: FieldFrame) => {
  const { layout, now, dt, pointer } = frame;
  const local = now - frame.stageStart - p.delay;

  if (p.stage !== frame.stage && local >= 0) {
    release(p, frame);
    p.stage = frame.stage;
  }

  const point = frame.shapes[p.stage][p.slot];
  p.accent = point.accent;

  const morph = p.stage === frame.stage ? clamp01(local / STAGE_MORPH_MS) : 1;
  const settle = morph * morph * (3 - 2 * morph);
  const wobble = layout.radius * 0.012;
  const tx = layout.cx + point.x * layout.radius + Math.sin(now * 0.0017 + p.phase) * wobble;
  const ty = layout.cy + point.y * layout.radius + Math.cos(now * 0.0013 + p.phase * 1.3) * wobble;
  const pull = 0.01 + 0.075 * settle;
  p.vx += (tx - p.x) * pull * dt;
  p.vy += (ty - p.y) * pull * dt;

  const turbulence = Math.sin(Math.PI * morph) * TURBULENCE;
  if (turbulence > 0.01) {
    const angle = flowAngle(p.x, p.y, now);
    p.vx += Math.cos(angle) * turbulence * dt;
    p.vy += Math.sin(angle) * turbulence * dt;
  }

  if (pointer.active) {
    const dx = p.x - pointer.x;
    const dy = p.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    if (distance < POINTER_REACH && distance > 0.5) {
      const force = (1 - distance / POINTER_REACH) ** 2 * POINTER_FORCE * dt;
      p.vx += ((dx - dy * POINTER_SWIRL) / distance) * force;
      p.vy += ((dy + dx * POINTER_SWIRL) / distance) * force;
    }
  }

  const damping = DAMPING ** dt;
  p.vx *= damping;
  p.vy *= damping;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
};
