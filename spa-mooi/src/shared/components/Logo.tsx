import { Sparkles } from 'lucide-react';
import { env } from '@/config/env';

export const Logo = () => (
  <span className="flex items-center gap-2.5">
    <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30">
      <Sparkles className="size-4.5" />
    </span>
    <span className="text-lg font-semibold tracking-tight">{env.appName}</span>
  </span>
);
