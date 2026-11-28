import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A tab kept in the URL (`?tab=files`), so reloads, shared links and Back keep it. Switching tabs
 * replaces the history entry: tabs are views of one screen, not steps to go back through.
 */
export const useTabParam = <T extends string>(ids: readonly T[], fallback: T, param = 'tab'): [T, (id: T) => void] => {
  const [params, setParams] = useSearchParams();
  const raw = params.get(param);
  const value = raw !== null && (ids as readonly string[]).includes(raw) ? (raw as T) : fallback;

  const setValue = useCallback((id: T) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id === fallback) next.delete(param);
      else next.set(param, id);
      return next;
    }, { replace: true, preventScrollReset: true });
  }, [setParams, fallback, param]);

  return [value, setValue];
};
