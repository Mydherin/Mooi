interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
}

export const SectionHeading = ({ eyebrow, title, description }: SectionHeadingProps) => (
  <div className="mx-auto max-w-2xl text-center">
    <p className="text-xs font-semibold tracking-[0.2em] text-indigo-500 uppercase dark:text-indigo-400">
      {eyebrow}
    </p>
    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
    <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
      {description}
    </p>
  </div>
);
