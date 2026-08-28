import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { marketingNavLinks } from '@/layouts/marketing/marketingNavLinks';
import { Container } from '@/shared/components/Container';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { useNavigationStore } from '@/stores/navigationStore';

export const MarketingMobileMenu = () => {
  const isMobileMenuOpen = useNavigationStore((state) => state.isMobileMenuOpen);
  const closeMobileMenu = useNavigationStore((state) => state.closeMobileMenu);

  if (!isMobileMenuOpen) {
    return null;
  }

  return (
    <div className="border-t border-line bg-surface md:hidden">
      <Container className="flex flex-col gap-1 py-4">
        {marketingNavLinks.map((link) => (
          <a
            key={link.id}
            href={link.href}
            onClick={closeMobileMenu}
            className="rounded-xl px-4 py-3 text-base font-medium text-ink-muted transition hover:bg-surface-2 hover:text-ink"
          >
            {link.label}
          </a>
        ))}

        <Link
          to={ROUTES.login}
          onClick={closeMobileMenu}
          className={buttonStyles('brand', 'md', 'mt-2 w-full')}
        >
          Get started
          <ArrowRight className="size-4" />
        </Link>
      </Container>
    </div>
  );
};
