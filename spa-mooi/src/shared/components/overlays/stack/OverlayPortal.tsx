import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface OverlayPortalProps {
  children: ReactNode;
}

const host = (): HTMLElement => {
  const existing = document.getElementById('overlays');
  if (existing) return existing;
  const created = document.createElement('div');
  created.id = 'overlays';
  document.body.append(created);
  return created;
};

/** Renders into `#overlays`, the sibling of `#root` that sits above the whole app (see `--z-overlay`). */
export const OverlayPortal = ({ children }: OverlayPortalProps) => createPortal(children, host());
