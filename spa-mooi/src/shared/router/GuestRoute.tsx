import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { useAuthStore } from '@/stores/authStore';

export const GuestRoute = () => {
  const player = useAuthStore((state) => state.player);
  const session = useAuthStore((state) => state.session);

  if (player && session) {
    return <Navigate to={ROUTES.account} replace />;
  }

  return <Outlet />;
};
