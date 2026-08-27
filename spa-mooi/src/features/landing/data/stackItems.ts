import { Boxes, Component, Palette, Route, Sparkles, Zap } from 'lucide-react';
import type { StackItem } from '@/features/landing/types/StackItem';

export const stackItems: StackItem[] = [
  { id: 'vite', name: 'Vite', role: 'Build tool, dev server and env loading', icon: Zap },
  { id: 'react', name: 'React + TypeScript', role: 'Typed component architecture', icon: Component },
  { id: 'tailwind', name: 'Tailwind CSS', role: 'Utility-first styling and theming', icon: Palette },
  { id: 'zustand', name: 'Zustand', role: 'Global state through small stores', icon: Boxes },
  { id: 'lucide', name: 'Lucide React', role: 'Consistent icon system', icon: Sparkles },
  { id: 'router', name: 'React Router DOM', role: 'Layout routes and navigation', icon: Route },
];
