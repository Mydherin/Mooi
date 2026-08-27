import { ArrowRight, Mail } from 'lucide-react';
import { env } from '@/config/env';
import { ActionLink } from '@/shared/components/ActionLink';
import { Container } from '@/shared/components/Container';

export const CtaSection = () => (
  <section id="start" className="scroll-mt-16 py-20 sm:py-28">
    <Container>
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-16 text-center shadow-2xl shadow-indigo-500/20 sm:px-12">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(30rem_18rem_at_50%_0%,rgba(255,255,255,0.28),transparent)]"
        />

        <h2 className="relative text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
          Start building {env.appName} today
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-base leading-relaxed text-indigo-100">
          Clone the artifact, run one command and iterate straight from this landing page.
        </p>

        <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ActionLink
            href={env.githubUrl}
            external
            variant="secondary"
            className="w-full border-white/30 bg-white text-slate-900 hover:bg-white sm:w-auto dark:border-white/30 dark:bg-white dark:text-slate-900 dark:hover:bg-white"
          >
            Get the code
            <ArrowRight className="size-4" />
          </ActionLink>
          <a
            href={`mailto:${env.contactEmail}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 sm:w-auto"
          >
            <Mail className="size-4" />
            {env.contactEmail}
          </a>
        </div>
      </div>
    </Container>
  </section>
);
