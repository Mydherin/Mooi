import { useEffect, useState } from 'react';
import { fetchDevelopmentEnvironment } from '@/features/development/api/developmentApi';
import type { PlatformEnvironmentVariable } from '@/features/platform/types/PlatformEnvironmentVariable';

interface UseDevelopmentEnvironment {
  variables: PlatformEnvironmentVariable[] | null;
  error: string | null;
}

/** The project's shared development variables, loaded once per mount. */
export const useDevelopmentEnvironment = (projectId: string): UseDevelopmentEnvironment => {
  const [state, setState] = useState<UseDevelopmentEnvironment>({ variables: null, error: null });

  useEffect(() => {
    let active = true;
    fetchDevelopmentEnvironment(projectId)
      .then(({ environment }) => { if (active) setState({ variables: environment, error: null }); })
      .catch((failure: Error) => { if (active) setState({ variables: [], error: failure.message }); });
    return () => { active = false; };
  }, [projectId]);

  return state;
};
