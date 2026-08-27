import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { useApplyTheme } from '@/shared/hooks/useApplyTheme';

export const App = () => {
  useApplyTheme();

  return <RouterProvider router={router} />;
};
