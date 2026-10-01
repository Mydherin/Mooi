export interface PlatformStreamState<S> {
  snapshot: S | null;
  logs: string[];
}
