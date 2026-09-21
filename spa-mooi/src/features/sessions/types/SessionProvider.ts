export interface SessionProvider {
  id: string;
  label: string;
  defaultModel: string;
  defaultEffort: string;
  models: { id: string; label: string; efforts: string[] }[];
}
