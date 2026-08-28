import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { useAuthStorageSync } from '@/features/auth/hooks/useAuthStorageSync';
import { useApplyTheme } from '@/shared/hooks/useApplyTheme';

export const App = () => {
  useApplyTheme();
  useAuthStorageSync();

  return <RouterProvider router={router} />;
};
