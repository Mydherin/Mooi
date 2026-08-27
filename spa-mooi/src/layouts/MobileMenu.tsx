import { ArrowUpRight } from 'lucide-react';
import { env } from '@/config/env';
import { navLinks } from '@/layouts/navLinks';
import { Container } from '@/shared/components/Container';
import { useNavigationStore } from '@/stores/navigationStore';

export const MobileMenu = () => {
  const isMobileMenuOpen = useNavigationStore((state) => state.isMobileMenuOpen);
  const closeMobileMenu = useNavigationStore((state) => state.closeMobileMenu);

  if (!isMobileMenuOpen) {
    return null;
  }

  return (
    <div className="border-t border-slate-200/70 bg-white/95 backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-slate-950/95">
      <Container className="flex flex-col gap-1 py-4">
        {navLinks.map((link) => (
          <a
            key={link.id}
            href={link.href}
            onClick={closeMobileMenu}
            className="rounded-xl px-4 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
          >
            {link.label}
          </a>
        ))}
        <a
          href={env.githubUrl}
          target="_blank"
          rel="noreferrer"
          onClick={closeMobileMenu}
          className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
        >
          Repository
          <ArrowUpRight className="size-4" />
        </a>
      </Container>
    </div>
  );
};
