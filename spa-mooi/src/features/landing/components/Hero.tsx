import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { env } from '@/config/env';
import { heroStats } from '@/features/landing/data/heroStats';
import { HeroBackground } from '@/features/landing/components/HeroBackground';
import { ActionLink } from '@/shared/components/ActionLink';
import { Container } from '@/shared/components/Container';

export const Hero = () => (
  <section className="relative overflow-hidden">
    <HeroBackground />

    <Container className="relative flex flex-col items-center py-24 text-center sm:py-32 lg:py-40">
      <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        <Sparkles className="size-3.5 text-indigo-500" />
        v{env.appVersion} · Vite + React + TypeScript
      </span>

      <h1
        className="animate-rise mt-8 max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
        style={{ animationDelay: '80ms' }}
      >
        {env.appName},{' '}
        <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
          {env.appTagline}
        </span>
      </h1>

      <p
        className="animate-rise mt-6 max-w-2xl text-base leading-relaxed text-pretty text-slate-600 sm:text-lg dark:text-slate-400"
        style={{ animationDelay: '160ms' }}
      >
        {env.appDescription}
      </p>

      <div
        className="animate-rise mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        style={{ animationDelay: '240ms' }}
      >
        <ActionLink href="#features" className="w-full sm:w-auto">
          Explore the scaffolding
          <ArrowRight className="size-4" />
        </ActionLink>
        <ActionLink href={env.docsUrl} variant="secondary" external className="w-full sm:w-auto">
          <BookOpen className="size-4" />
          Read the docs
        </ActionLink>
      </div>

      <dl
        className="animate-rise mt-16 grid w-full grid-cols-2 gap-6 border-t border-slate-200/70 pt-10 sm:gap-8 lg:grid-cols-4 dark:border-white/10"
        style={{ animationDelay: '320ms' }}
      >
        {heroStats.map((stat) => (
          <div key={stat.id} className="flex flex-col items-center gap-1">
            <dt className="order-2 text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {stat.label}
            </dt>
            <dd className="order-1 text-2xl font-semibold sm:text-3xl">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </Container>
  </section>
);
