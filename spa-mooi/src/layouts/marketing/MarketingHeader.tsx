import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { HeaderAuthActions } from '@/features/auth/components/HeaderAuthActions';
import { MarketingMobileMenu } from '@/layouts/marketing/MarketingMobileMenu';
import { marketingNavLinks } from '@/layouts/marketing/marketingNavLinks';
import { Container } from '@/shared/components/Container';
import { IconButton } from '@/shared/components/IconButton';
import { Logo } from '@/shared/components/Logo';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { useNavigationStore } from '@/stores/navigationStore';

export const MarketingHeader = () => {
  const isMobileMenuOpen = useNavigationStore((state) => state.isMobileMenuOpen);
  const toggleMobileMenu = useNavigationStore((state) => state.toggleMobileMenu);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          to={ROUTES.home}
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {marketingNavLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <HeaderAuthActions />
          <IconButton
            icon={isMobileMenuOpen ? X : Menu}
            label="Toggle navigation"
            onClick={toggleMobileMenu}
            className="md:hidden"
          />
        </div>
      </Container>

      <MarketingMobileMenu />
    </header>
  );
};
