import { useEffect } from 'react';
import { env } from '@/config/env';
import { useAuthStore } from '@/stores/authStore';

const STORAGE_KEY = `${env.storagePrefix}:auth`;

/** Rehydrates the store when another tab writes the persisted auth state. */
export const useAuthStorageSync = (): void => {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        void useAuthStore.persist.rehydrate();
      }
    };

    window.addEventListener('storage', onStorage);

    return () => window.removeEventListener('storage', onStorage);
  }, []);
};
