import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { useAuthStorageSync } from '@/features/auth/hooks/useAuthStorageSync';
import { useAppViewport } from '@/shared/hooks/useAppViewport';
import { useApplyTheme } from '@/shared/hooks/useApplyTheme';
import { useNativeTouchGuards } from '@/shared/hooks/useNativeTouchGuards';

export const App = () => {
  useApplyTheme();
  useAppViewport();
  useNativeTouchGuards();
  useAuthStorageSync();

  return <RouterProvider router={router} />;
};
