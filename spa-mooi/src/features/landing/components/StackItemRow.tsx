import type { StackItem } from '@/features/landing/types/StackItem';

interface StackItemRowProps {
  item: StackItem;
}

export const StackItemRow = ({ item }: StackItemRowProps) => {
  const Icon = item.icon;

  return (
    <li className="flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 transition hover:border-slate-200 hover:bg-white/60 dark:hover:border-white/10 dark:hover:bg-white/5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-indigo-400">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{item.name}</span>
        <span className="block truncate text-sm text-slate-600 dark:text-slate-400">
          {item.role}
        </span>
      </span>
    </li>
  );
};
