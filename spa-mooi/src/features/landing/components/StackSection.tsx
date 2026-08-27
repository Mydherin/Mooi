import { stackItems } from '@/features/landing/data/stackItems';
import { StackItemRow } from '@/features/landing/components/StackItemRow';
import { StateDemoCard } from '@/features/landing/components/StateDemoCard';
import { Container } from '@/shared/components/Container';

export const StackSection = () => (
  <section
    id="stack"
    className="scroll-mt-16 border-y border-slate-200/70 bg-slate-50/60 py-20 sm:py-28 dark:border-white/10 dark:bg-white/[0.02]"
  >
    <Container className="grid items-center gap-12 lg:grid-cols-2">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-indigo-500 uppercase dark:text-indigo-400">
          Stack
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Six pieces, one coherent setup
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          Each dependency has a clear job and at least one real use case already running in this
          landing page.
        </p>

        <ul className="mt-8 space-y-1">
          {stackItems.map((item) => (
            <StackItemRow key={item.id} item={item} />
          ))}
        </ul>
      </div>

      <StateDemoCard />
    </Container>
  </section>
);
