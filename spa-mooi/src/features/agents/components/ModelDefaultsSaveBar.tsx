import { useEffect, useState } from 'react';
import { CircleCheck, LoaderCircle } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface ModelDefaultsSaveBarProps {
  dirtyCount: number;
  saving: boolean;
  savedAt: number | null;
  onSave: () => void;
  onDiscard: () => void;
}

const SAVED_VISIBLE_MS = 2400;

/** Floating confirmation bar: one place to save or discard every unsaved account at once. */
export const ModelDefaultsSaveBar = ({ dirtyCount, saving, savedAt, onSave, onDiscard }: ModelDefaultsSaveBarProps) => {
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!savedAt) return;
    setJustSaved(true);
    const timer = window.setTimeout(() => setJustSaved(false), SAVED_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  const visible = dirtyCount > 0 || saving || justSaved;

  return <div aria-live="polite" className={cn('fixed inset-x-4 bottom-4 z-30 mx-auto max-w-xl transition duration-300 sm:bottom-6',
    visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0')}>
    <div className="flex items-center gap-3 rounded-2xl bg-contrast py-2.5 pr-2.5 pl-4 text-contrast-ink shadow-2xl shadow-black/25">
      {dirtyCount > 0 || saving ? <>
        <span className="relative flex size-2 shrink-0"><span className="absolute inset-0 animate-ping rounded-full bg-info-dot opacity-60" /><span className="relative size-2 rounded-full bg-info-dot" /></span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">
          Unsaved changes<span className="font-medium opacity-60"> · {dirtyCount} account{dirtyCount === 1 ? '' : 's'}</span>
        </p>
        <button type="button" onClick={onDiscard} disabled={saving}
          className="h-10 shrink-0 rounded-[10px] px-3.5 text-[13px] font-bold opacity-70 transition hover:bg-contrast-ink/10 hover:opacity-100 disabled:opacity-40">
          Discard
        </button>
        <button type="button" onClick={onSave} disabled={saving}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] bg-contrast-ink px-4 text-[13px] font-bold text-contrast transition hover:opacity-90 disabled:opacity-70">
          {saving && <LoaderCircle className="size-4 animate-spin" />} Save changes
        </button>
      </> : <p className="flex h-10 items-center gap-2 text-sm font-bold">
        <CircleCheck className="size-4 text-success-dot" /> All changes saved
      </p>}
    </div>
  </div>;
};
