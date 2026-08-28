import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import type { PlayerRole } from '@/features/auth/types/PlayerRole';
import { useAuthStore } from '@/stores/authStore';

interface RoleRouteProps {
  role: PlayerRole;
  redirectTo?: string;
}

export const RoleRoute = ({ role, redirectTo = ROUTES.projects }: RoleRouteProps) => {
  const player = useAuthStore((state) => state.player);

  if (!player) {
    return <Navigate to={ROUTES.login} replace />;
  }

  if (player.role !== role) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
};
