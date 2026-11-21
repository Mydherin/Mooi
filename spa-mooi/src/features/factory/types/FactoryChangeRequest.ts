/** A change the user decided, applied by the loop at its next safe point. */
export interface FactoryChangeRequest {
  id: string;
  number: number;
  text: string;
  status: 'queued' | 'analyzing' | 'awaiting-confirmation' | 'applied' | 'rejected';
  /** It alters the project's scope: it waits for (or received) the user's confirmation. */
  scopeLevel: boolean;
  analysis: string | null;
  createdAt: string;
  resolvedAt: string | null;
}
