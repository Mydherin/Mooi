import type { PlatformEnvironmentVariable } from '@/features/platform/types/PlatformEnvironmentVariable';

/** The variables every session of a project shares: names only, values never reach the browser. */
export interface DevelopmentEnvironment {
  environment: PlatformEnvironmentVariable[];
}
