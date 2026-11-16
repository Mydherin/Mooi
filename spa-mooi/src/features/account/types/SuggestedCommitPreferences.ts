export type SuggestedCommitLanguage = 'en' | 'es';

export interface SuggestedCommitPreferences {
  enabled: boolean;
  language: SuggestedCommitLanguage;
}
