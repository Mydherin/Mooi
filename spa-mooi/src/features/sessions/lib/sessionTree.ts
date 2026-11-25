import type { Session } from '@/features/sessions/types/Session';

export interface SessionTreeRow {
  session: Session;
  /** 0 for a session listed on its own; each level below the session that opened it adds one. */
  depth: number;
}

/**
 * Lists every session under the one whose agent opened it, keeping the incoming order (newest first)
 * at each level. A session whose origin is not in the list stands at the top level on its own; a
 * cycle cannot happen (an origin always exists before the sessions it opens), but is cut anyway.
 */
export const sessionTree = (sessions: Session[]): SessionTreeRow[] => {
  const listed = new Set(sessions.map((session) => session.id));
  const children = new Map<string, Session[]>();
  const roots: Session[] = [];

  for (const session of sessions) {
    const origin = session.origin?.sessionId;
    if (origin && origin !== session.id && listed.has(origin)) {
      children.set(origin, [...(children.get(origin) ?? []), session]);
    } else {
      roots.push(session);
    }
  }

  const rows: SessionTreeRow[] = [];
  const seen = new Set<string>();
  const visit = (session: Session, depth: number) => {
    if (seen.has(session.id)) return;
    seen.add(session.id);
    rows.push({ session, depth });
    for (const child of children.get(session.id) ?? []) visit(child, depth + 1);
  };
  roots.forEach((session) => visit(session, 0));
  // Sessions only reachable through a cycle still show, at the top level.
  sessions.filter((session) => !seen.has(session.id)).forEach((session) => visit(session, 0));

  return rows;
};
