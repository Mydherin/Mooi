import { AppUserMenu } from '@/layouts/app/AppUserMenu';

interface AppSidebarUserProps {
  onNavigate?: () => void;
}

/**
 * The foot of the rail: the account menu in its full, name/avatar/email shape.
 */
export const AppSidebarUser = ({ onNavigate }: AppSidebarUserProps) => (
  <div className="shrink-0 border-t border-line p-3">
    <AppUserMenu variant="full" onNavigate={onNavigate} />
  </div>
);
