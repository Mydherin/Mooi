import { create } from 'zustand';
import type { ToastMessage } from '@/shared/components/feedback/toast/ToastMessage';

interface ToastState {
  toasts: ToastMessage[];
  push: (toast: ToastMessage) => void;
  dismiss: (id: string) => void;
}

/** At most this many toasts at once; older ones leave first. */
const LIMIT = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => set((state) => ({ toasts: [...state.toasts.filter((current) => current.id !== toast.id), toast].slice(-LIMIT) })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
