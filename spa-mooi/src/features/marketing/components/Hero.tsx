import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { env } from '@/config/env';
import { HeroBackground } from '@/features/marketing/components/HeroBackground';
import { HeroChips } from '@/features/marketing/components/HeroChips';
import { ActionLink } from '@/shared/components/ActionLink';
import { Container } from '@/shared/components/Container';
import { buttonStyles } from '@/shared/styles/buttonStyles';

export const Hero = () => (
  <section className="relative overflow-hidden py-20 sm:py-28 lg:py-32">
    <HeroBackground />

    <Container className="flex flex-col items-center text-center">
      <span
        className="inline-flex animate-rise items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-muted"
        style={{ animationDelay: '0ms' }}
      >
        <Sparkles className="size-3.5 text-brand" />
        Agent sessions on your own repositories
      </span>

      <h1
        className="mt-6 animate-rise text-4xl font-semibold tracking-tight text-balance text-ink sm:text-6xl lg:text-7xl"
        style={{ animationDelay: '80ms' }}
      >
        Ship from a chat,{' '}
        <span className="bg-gradient-to-r from-brand via-info to-brand bg-clip-text text-transparent">
          straight to production.
        </span>
      </h1>

      <p
        className="mt-6 max-w-2xl animate-rise text-base leading-relaxed text-ink-muted sm:text-lg"
        style={{ animationDelay: '160ms' }}
      >
        {env.appDescription}
      </p>

      <div
        className="mt-9 flex w-full animate-rise flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        style={{ animationDelay: '240ms' }}
      >
        <Link to={ROUTES.login} className={buttonStyles('brand', 'lg', 'w-full sm:w-auto')}>
          Start building
          <ArrowRight className="size-4" />
        </Link>
        <ActionLink href="#workflow" variant="secondary" size="lg" className="w-full sm:w-auto">
          See how it works
        </ActionLink>
      </div>

      <div className="mt-10 animate-rise" style={{ animationDelay: '320ms' }}>
        <HeroChips />
      </div>
    </Container>
  </section>
);
