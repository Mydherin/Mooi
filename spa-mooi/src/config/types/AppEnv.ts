export interface AppEnv {
  appName: string;
  appTagline: string;
  appDescription: string;
  appVersion: string;
  githubUrl: string;
  docsUrl: string;
  contactEmail: string;
  apiBaseUrl: string;
  sessionsBaseUrl: string;
  sessionsRefreshMs: number;
  streamStaleMs: number;
  speechBaseUrl: string;
  googleClientId: string;
  storagePrefix: string;
}
