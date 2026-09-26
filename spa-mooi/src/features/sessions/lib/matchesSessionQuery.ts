import type { Session } from '@/features/sessions/types/Session';

export const matchesSessionQuery = (session: Session, query: string): boolean => {
  const needle = query.trim().toLowerCase();

  if (!needle) return true;

  return [session.branch, session.projectFullName, session.providerLabel, session.model]
    .some((value) => value?.toLowerCase().includes(needle));
};
