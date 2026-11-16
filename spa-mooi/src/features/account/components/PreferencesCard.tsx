import { useEffect, useState } from 'react';
import { LoaderCircle, MoonStar, RefreshCw, Sun } from 'lucide-react';
import { fetchSuggestedCommitPreferences, saveSuggestedCommitPreferences } from '@/features/account/api/suggestedCommitApi';
import type { SuggestedCommitLanguage, SuggestedCommitPreferences } from '@/features/account/types/SuggestedCommitPreferences';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import type { SegmentItem } from '@/shared/types/SegmentItem';
import type { Theme } from '@/shared/types/Theme';
import { useThemeStore } from '@/stores/themeStore';

const themes: SegmentItem[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: MoonStar },
];

const languages: SegmentItem[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

export const PreferencesCard = () => {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [suggestedCommit, setSuggestedCommit] = useState<SuggestedCommitPreferences | null>(null);
  const [loadingSuggestedCommit, setLoadingSuggestedCommit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchSuggestedCommitPreferences()
      .then((preferences) => { if (active) setSuggestedCommit(preferences); })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Could not load suggested commit settings.');
      })
      .finally(() => { if (active) setLoadingSuggestedCommit(false); });
    return () => { active = false; };
  }, []);

  const updateSuggestedCommit = async (next: SuggestedCommitPreferences) => {
    if (!suggestedCommit || saving) return;
    const previous = suggestedCommit;
    setSuggestedCommit(next);
    setSaving(true);
    setError(null);
    try {
      setSuggestedCommit(await saveSuggestedCommitPreferences(next));
    } catch (failure) {
      setSuggestedCommit(previous);
      setError(failure instanceof Error ? failure.message : 'Could not save suggested commit settings.');
    } finally {
      setSaving(false);
    }
  };

  const retrySuggestedCommit = async () => {
    setLoadingSuggestedCommit(true);
    setError(null);
    try {
      setSuggestedCommit(await fetchSuggestedCommitPreferences());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load suggested commit settings.');
    } finally {
      setLoadingSuggestedCommit(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold tracking-[-0.015em] text-ink">Preferences</h2>

      <p className="mt-4 text-[13px] font-bold text-ink">Appearance</p>

      <div className="sm:flex sm:items-center sm:justify-between sm:gap-6">
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
          The preference is per device: it does not travel with your account.
        </p>

        <SegmentedControl
          items={themes}
          value={theme}
          onChange={(id) => setTheme(id as Theme)}
          className="mt-4 flex w-full sm:mt-0 sm:w-auto sm:shrink-0"
        />
      </div>

      <div className="my-5 border-t border-line" />

      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-ink">Suggested commit message</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            Fill the merge dialog with an editable title based on your request and the work completed in the session.
          </p>
        </div>
        {suggestedCommit ? (
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted">
            <input type="checkbox" checked={suggestedCommit.enabled} disabled={saving}
              onChange={(event) => void updateSuggestedCommit({ ...suggestedCommit, enabled: event.target.checked })}
              className="size-4 rounded border-line accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
            Enabled
          </label>
        ) : loadingSuggestedCommit
          ? <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-ink-subtle" aria-label="Loading settings" />
          : null}
      </div>

      {suggestedCommit ? (
        <div className="mt-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p id="suggested-commit-language" className="text-[13px] font-semibold text-ink">Language</p>
            <p className="mt-1 text-xs text-ink-subtle">Used for new suggestions in every development session.</p>
          </div>
          <SegmentedControl items={languages} value={suggestedCommit.language}
            onChange={(language) => void updateSuggestedCommit({ ...suggestedCommit, language: language as SuggestedCommitLanguage })}
            disabled={!suggestedCommit.enabled || saving}
            labelledBy="suggested-commit-language" className="mt-3 flex w-full sm:mt-0 sm:w-auto sm:shrink-0"
          />
        </div>
      ) : null}

      {error ? <div className="mt-4 flex flex-wrap items-center gap-3">
        <p role="alert" className="min-w-0 flex-1 text-sm text-danger">{error}</p>
        {!suggestedCommit ? <Button variant="secondary" size="sm" disabled={loadingSuggestedCommit}
          onClick={() => void retrySuggestedCommit()}>
          {loadingSuggestedCommit ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Try again
        </Button> : null}
      </div> : null}
    </Card>
  );
};
