import { Blocks, Gauge, Moon, Palette, ShieldCheck, Smartphone } from 'lucide-react';
import type { Feature } from '@/features/landing/types/Feature';

export const features: Feature[] = [
  {
    id: 'speed',
    title: 'Instant feedback',
    description: 'Vite dev server with hot module replacement keeps every change under a blink.',
    icon: Gauge,
  },
  {
    id: 'modular',
    title: 'Modular by design',
    description: 'Feature folders, single-responsibility files, high cohesion and low coupling.',
    icon: Blocks,
  },
  {
    id: 'typed',
    title: 'Strict typing',
    description: 'TypeScript in strict mode, one type per file and a typed environment layer.',
    icon: ShieldCheck,
  },
  {
    id: 'styling',
    title: 'Utility styling',
    description: 'Tailwind CSS v4 with a token-driven theme, gradients and glass surfaces.',
    icon: Palette,
  },
  {
    id: 'theme',
    title: 'Persisted theme',
    description: 'Zustand store keeps the light and dark preference across reloads.',
    icon: Moon,
  },
  {
    id: 'responsive',
    title: 'Responsive first',
    description: 'Fluid layouts and a dedicated mobile navigation from the very first pixel.',
    icon: Smartphone,
  },
];
