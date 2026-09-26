import { requireEnv } from '@/config/requireEnv';
import { requirePositiveNumber } from '@/config/requirePositiveNumber';
import type { AppEnv } from '@/config/types/AppEnv';

export const env: AppEnv = {
  appName: requireEnv(import.meta.env.VITE_APP_NAME, 'VITE_APP_NAME'),
  appTagline: requireEnv(import.meta.env.VITE_APP_TAGLINE, 'VITE_APP_TAGLINE'),
  appDescription: requireEnv(import.meta.env.VITE_APP_DESCRIPTION, 'VITE_APP_DESCRIPTION'),
  appVersion: requireEnv(import.meta.env.VITE_APP_VERSION, 'VITE_APP_VERSION'),
  githubUrl: requireEnv(import.meta.env.VITE_GITHUB_URL, 'VITE_GITHUB_URL'),
  docsUrl: requireEnv(import.meta.env.VITE_DOCS_URL, 'VITE_DOCS_URL'),
  contactEmail: requireEnv(import.meta.env.VITE_CONTACT_EMAIL, 'VITE_CONTACT_EMAIL'),
  apiBaseUrl: requireEnv(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL'),
  sessionsBaseUrl: requireEnv(import.meta.env.VITE_SESSIONS_BASE_URL, 'VITE_SESSIONS_BASE_URL'),
  sessionsRefreshMs: requirePositiveNumber(import.meta.env.VITE_SESSIONS_REFRESH_SECONDS, 'VITE_SESSIONS_REFRESH_SECONDS') * 1000,
  googleClientId: requireEnv(import.meta.env.VITE_GOOGLE_CLIENT_ID, 'VITE_GOOGLE_CLIENT_ID'),
  storagePrefix: requireEnv(import.meta.env.VITE_STORAGE_PREFIX, 'VITE_STORAGE_PREFIX'),
};
