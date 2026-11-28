import { useMemo, useState } from 'react';
import { normalizeVariableName, prefixedVariableName, VARIABLE_NAME } from '@/features/platform/lib/environmentNames';
import type { PlatformEnvironmentVariable } from '@/features/platform/types/PlatformEnvironmentVariable';

export interface NewVariable {
  key: number;
  name: string;
  value: string;
}

interface EnvironmentDraft {
  values: Record<string, string>;
  removed: ReadonlySet<string>;
  added: NewVariable[];
  /** Why each new variable's name cannot be saved, by its key. */
  nameErrors: Record<number, string>;
  /** Names to values, `null` removing one: what saving sends. */
  update: Record<string, string | null>;
  changes: number;
  valid: boolean;
  setValue: (name: string, value: string) => void;
  toggleRemoved: (name: string) => void;
  add: () => void;
  edit: (key: number, change: Partial<Pick<NewVariable, 'name' | 'value'>>) => void;
  discard: (key: number) => void;
}

/**
 * The unsaved edits of an environment editor. Values are write-only, so a blank value keeps what is
 * stored; new names get the owner's prefix and are checked against the stored ones and each other.
 */
export const useEnvironmentDraft = (prefix: string, variables: PlatformEnvironmentVariable[]): EnvironmentDraft => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<NewVariable[]>([]);
  const [nextKey, setNextKey] = useState(0);

  const nameErrors = useMemo(() => {
    const stored = new Set(variables.map((variable) => variable.name));
    const seen = new Set<string>();
    const errors: Record<number, string> = {};
    added.forEach(({ key, name, value }) => {
      if (!name) { if (value) errors[key] = 'Name the variable.'; return; }
      const full = prefixedVariableName(prefix, name);
      if (!VARIABLE_NAME.test(name) || !VARIABLE_NAME.test(full)) errors[key] = 'Use letters, digits and underscores only.';
      else if (stored.has(full) || seen.has(full)) errors[key] = 'A variable with this name already exists.';
      seen.add(full);
    });
    return errors;
  }, [added, prefix, variables]);

  const update = useMemo(() => {
    const next: Record<string, string | null> = {};
    Object.entries(values).forEach(([name, value]) => { if (value.length > 0 && !removed.has(name)) next[name] = value; });
    removed.forEach((name) => { next[name] = null; });
    added.forEach(({ name, value }) => { if (name && value.length > 0) next[prefixedVariableName(prefix, name)] = value; });
    return next;
  }, [values, removed, added, prefix]);

  return {
    values, removed, added, nameErrors, update,
    changes: Object.keys(update).length,
    valid: Object.keys(nameErrors).length === 0,
    setValue: (name, value) => setValues((current) => ({ ...current, [name]: value })),
    toggleRemoved: (name) => setRemoved((current) => {
      const next = new Set(current);
      if (!next.delete(name)) next.add(name);
      return next;
    }),
    add: () => { setAdded((current) => [...current, { key: nextKey, name: '', value: '' }]); setNextKey((key) => key + 1); },
    edit: (key, change) => setAdded((current) => current.map((item) => (item.key === key
      ? { ...item, ...change, ...(change.name !== undefined ? { name: normalizeVariableName(change.name) } : {}) } : item))),
    discard: (key) => setAdded((current) => current.filter((item) => item.key !== key)),
  };
};
