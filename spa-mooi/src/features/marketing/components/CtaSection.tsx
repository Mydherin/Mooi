import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { env } from '@/config/env';
import { Container } from '@/shared/components/Container';

export const CtaSection = () => (
  <section className="pb-20 sm:pb-28">
    <Container>
      <div className="relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-br from-brand via-brand-strong to-info px-6 py-16 text-center sm:px-12">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(255,255,255,0.35), transparent 70%)',
          }}
        />

        <div className="relative">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
            Start your first session
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/80">
            Connect a repository and watch the first diff land in minutes.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={ROUTES.login}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-medium text-brand transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            >
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <a
              href={env.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/40 px-6 text-base font-medium text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            >
              Read the docs
            </a>
          </div>
        </div>
      </div>
    </Container>
  </section>
);
