import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { HeroBackground } from '@/features/marketing/components/HeroBackground';
import { Container } from '@/shared/components/Container';
import { buttonStyles } from '@/shared/styles/buttonStyles';

export const NotFoundPage = () => (
  <section className="relative flex min-h-[70vh] items-center overflow-hidden py-20">
    <HeroBackground />

    <Container className="flex flex-col items-center text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Compass className="size-6" />
      </span>

      <p className="mt-8 bg-gradient-to-r from-brand via-info to-brand bg-clip-text text-6xl font-semibold text-transparent sm:text-7xl">
        404
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance text-ink sm:text-3xl">
        This page does not exist yet
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-ink-muted">
        The route you followed is not part of the workspace. Head back and pick a project.
      </p>

      <div className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
        <Link to={ROUTES.home} className={buttonStyles('primary', 'md', 'w-full sm:w-auto')}>
          Back home
        </Link>
        <Link
          to={ROUTES.projects}
          className={buttonStyles('secondary', 'md', 'w-full sm:w-auto')}
        >
          Go to projects
        </Link>
      </div>
    </Container>
  </section>
);
