import { Link } from 'react-router-dom';
import { FolderGit2, Menu, X } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { env } from '@/config/env';
import { navLinks } from '@/layouts/navLinks';
import { MobileMenu } from '@/layouts/MobileMenu';
import { Container } from '@/shared/components/Container';
import { Logo } from '@/shared/components/Logo';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { useNavigationStore } from '@/stores/navigationStore';

export const Header = () => {
  const isMobileMenuOpen = useNavigationStore((state) => state.isMobileMenuOpen);
  const toggleMobileMenu = useNavigationStore((state) => state.toggleMobileMenu);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
      <Container className="flex h-16 items-center justify-between">
        <Link to={ROUTES.home} className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <a
            href={env.githubUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open repository"
            className="hidden size-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:flex dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <FolderGit2 className="size-5" />
          </a>
          <button
            type="button"
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation"
            aria-expanded={isMobileMenuOpen}
            className="flex size-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:hidden dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </Container>

      <MobileMenu />
    </header>
  );
};
