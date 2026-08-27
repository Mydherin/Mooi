export const HeroBackground = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(60rem_38rem_at_50%_-12%,var(--color-indigo-100),transparent)] dark:bg-[radial-gradient(60rem_38rem_at_50%_-12%,color-mix(in_oklab,var(--color-indigo-500)_28%,transparent),transparent)]" />
    <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-slate-900)_6%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-slate-900)_6%,transparent)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(38rem_26rem_at_50%_16%,black,transparent)] dark:bg-[linear-gradient(to_right,color-mix(in_oklab,white_7%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,white_7%,transparent)_1px,transparent_1px)]" />
    <div className="animate-float-slow absolute -top-32 -left-24 size-96 rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-600/25" />
    <div className="animate-float-fast absolute -top-10 -right-24 size-80 rounded-full bg-fuchsia-400/25 blur-3xl dark:bg-fuchsia-600/20" />
  </div>
);
