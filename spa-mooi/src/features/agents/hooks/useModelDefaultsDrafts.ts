import { useCallback, useEffect, useMemo, useState } from 'react';
import { saveModelDefaults } from '@/features/agents/lib/saveModelDefaults';
import { sameModelDefaults } from '@/features/agents/lib/sameModelDefaults';
import { toModelDefaults } from '@/features/agents/lib/toModelDefaults';
import type { AccountCatalog } from '@/features/agents/types/AccountCatalog';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { ModelChoice } from '@/features/agents/types/ModelChoice';
import type { ModelDefaults } from '@/features/agents/types/ModelDefaults';
import type { ModelPurposeId } from '@/features/agents/types/ModelPurposeId';

interface UseModelDefaultsDrafts {
  defaultsFor: (id: string) => ModelDefaults;
  change: (id: string, purpose: ModelPurposeId, choice: ModelChoice) => void;
  isDirty: (id: string) => boolean;
  dirtyIds: string[];
  saving: boolean;
  savedAt: number | null;
  saveErrors: Record<string, string>;
  save: () => Promise<void>;
  discard: () => void;
}

/**
 * Unsaved model choices for every account at once, saved together from a single bar.
 *
 * The saved values stay on the connections; a draft only exists for an account the admin touched,
 * so switching accounts or refreshing catalogs never loses work.
 */
export const useModelDefaultsDrafts = (accounts: AccountCatalog[],
  onSaved: (connection: AgentConnection) => void): UseModelDefaultsDrafts => {
  const [drafts, setDrafts] = useState<Record<string, ModelDefaults>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const saved = useMemo(() => Object.fromEntries(accounts.map(({ connection }) =>
    [connection.id, toModelDefaults(connection)])), [accounts]);

  const dirtyIds = useMemo(() => Object.keys(drafts).filter((id) =>
    saved[id] && !sameModelDefaults(drafts[id], saved[id])), [drafts, saved]);

  const defaultsFor = useCallback((id: string) => drafts[id] ?? saved[id], [drafts, saved]);
  const isDirty = useCallback((id: string) => dirtyIds.includes(id), [dirtyIds]);

  const change = useCallback((id: string, purpose: ModelPurposeId, choice: ModelChoice) => {
    setSavedAt(null);
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? saved[id]), [purpose]: choice } }));
  }, [saved]);

  const discard = useCallback(() => {
    setDrafts({});
    setSaveErrors({});
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveErrors({});
    const results = await Promise.allSettled(dirtyIds.map((id) => saveModelDefaults(id, drafts[id])));
    const errors: Record<string, string> = {};
    const done: string[] = [];
    results.forEach((result, index) => {
      const id = dirtyIds[index];
      if (result.status === 'fulfilled') {
        onSaved(result.value);
        done.push(id);
      } else {
        errors[id] = result.reason instanceof Error ? result.reason.message : 'Could not save model defaults.';
      }
    });
    setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !done.includes(id))));
    setSaveErrors(errors);
    if (Object.keys(errors).length === 0) setSavedAt(Date.now());
    setSaving(false);
  }, [dirtyIds, drafts, onSaved]);

  useEffect(() => {
    if (dirtyIds.length === 0) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirtyIds.length]);

  return { defaultsFor, change, isDirty, dirtyIds, saving, savedAt, saveErrors, save, discard };
};
