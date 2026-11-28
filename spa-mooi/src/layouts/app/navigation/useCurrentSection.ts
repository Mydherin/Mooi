import { useLocation } from 'react-router-dom';
import { appNavLinks } from '@/layouts/app/navigation/appNavLinks';
import type { AppNavLink } from '@/layouts/app/types/AppNavLink';

/** The top-level section the current path belongs to, by the longest matching link. */
export const useCurrentSection = (): AppNavLink | undefined => {
  const { pathname } = useLocation();
  return appNavLinks
    .filter((link) => pathname === link.to || pathname.startsWith(`${link.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
};
