/** A platform configuration: documents living only in Mooi, as the active and the draft revision. */
export interface PlatformDocuments<F> {
  active: F | null;
  draft: F | null;
  revision: number;
  /** Names of the stored environment variables; values are write-only. */
  environment: string[];
}
