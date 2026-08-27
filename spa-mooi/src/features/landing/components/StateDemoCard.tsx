import { MoonStar, Sun } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

export const StateDemoCard = () => {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="absolute -top-16 -right-16 size-40 rounded-full bg-violet-500/20 blur-3xl" />

      <p className="relative text-xs font-semibold tracking-[0.2em] text-indigo-500 uppercase dark:text-indigo-400">
        Live store
      </p>
      <h3 className="relative mt-3 text-lg font-semibold">Global state in two clicks</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        The header toggle and these buttons share a single Zustand store, persisted in local storage.
      </p>

      <div className="relative mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTheme('light')}
          aria-pressed={theme === 'light'}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
            theme === 'light'
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/25'
          }`}
        >
          <Sun className="size-4" />
          Light
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          aria-pressed={theme === 'dark'}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
            theme === 'dark'
              ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-300'
              : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/25'
          }`}
        >
          <MoonStar className="size-4" />
          Dark
        </button>
      </div>

      <p className="relative mt-4 font-mono text-xs text-slate-500 dark:text-slate-400">
        useThemeStore → theme: "{theme}"
      </p>
    </div>
  );
};
