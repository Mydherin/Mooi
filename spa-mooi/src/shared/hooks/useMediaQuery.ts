import { useSyncExternalStore } from 'react';

const lists = new Map<string, MediaQueryList>();

const listFor = (query: string): MediaQueryList => {
  let list = lists.get(query);
  if (!list) {
    list = window.matchMedia(query);
    lists.set(query, list);
  }
  return list;
};

/** Whether `query` matches, re-rendering only when that answer changes. */
export const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    (notify) => {
      const list = listFor(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => listFor(query).matches,
    () => false,
  );
