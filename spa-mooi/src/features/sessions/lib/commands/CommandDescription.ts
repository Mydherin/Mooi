export type CommandKind = 'read' | 'search' | 'list' | 'edit' | 'command';

/** One named part of a multi-command script, e.g. "Created directory" + "features/hello". */
export interface CommandStep {
  active: string;
  done: string;
  detail: string | null;
}

export interface CommandDescription {
  kind: CommandKind;
  /** Verb phrase while the command runs, e.g. "Searching for". */
  active: string;
  /** Verb phrase once it finished, e.g. "Searched for". */
  done: string;
  /** The subject, rendered in mono next to the verb: a file, a pattern, the short command. */
  detail: string | null;
  /** The file a shell write targets, so a summary counts it as an edited file. */
  target: string | null;
  /** The named parts when the line chains several commands; empty for a single one. */
  steps: CommandStep[];
  /** The command the user should read when expanding: a `bash -lc '…'` wrapper is peeled off. */
  display: string;
}

/** One simple command described. `raw`: the detail is just the command line, which a one-line chain need not repeat. */
export type Described = Omit<CommandDescription, 'display' | 'steps'> & { raw?: boolean };
