import { cn } from '@/shared/utils/cn';

/** Echoed `$ docker compose …` commands stand out from the output they produce. */
export const DeployTerminalLine = ({ line }: { line: string }) => (
  <span className={cn('block min-w-0 whitespace-pre-wrap break-words leading-relaxed',
    line.startsWith('$ ') ? 'mt-2 font-semibold text-emerald-300 first:mt-0' : 'text-neutral-200')}>{line || ' '}</span>
);
