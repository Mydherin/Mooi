export interface SessionProvider {
  id: string;
  label: string;
  defaultModel: string;
  defaultEffort: string | null;
  unavailable?: string;
  models: { id: string; label: string; efforts: string[]; defaultEffort?: string }[];
}
