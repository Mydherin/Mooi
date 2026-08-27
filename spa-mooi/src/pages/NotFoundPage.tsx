import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { Container } from '@/shared/components/Container';

export const NotFoundPage = () => (
  <Container className="flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
    <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
      <Compass className="size-6" />
    </span>

    <p className="mt-8 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-6xl font-semibold text-transparent sm:text-7xl">
      404
    </p>
    <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Page not found</h1>
    <p className="mt-3 max-w-md text-base text-slate-600 dark:text-slate-400">
      The route you followed does not exist yet. Head back to the landing page and keep exploring.
    </p>

    <Link to={ROUTES.home} className={buttonStyles('primary', 'mt-8')}>
      <ArrowLeft className="size-4" />
      Back home
    </Link>
  </Container>
);
