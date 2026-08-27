import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { RootLayout } from '@/layouts/RootLayout';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: ROUTES.home, element: <LandingPage /> },
      { path: ROUTES.notFound, element: <NotFoundPage /> },
    ],
  },
]);
