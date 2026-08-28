import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { useSessionSync } from '@/features/auth/hooks/useSessionSync';
import { useAuthStore } from '@/stores/authStore';

export const ProtectedRoute = () => {
  const player = useAuthStore((state) => state.player);
  const session = useAuthStore((state) => state.session);

  useSessionSync();

  if (!player || !session) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return <Outlet />;
};
