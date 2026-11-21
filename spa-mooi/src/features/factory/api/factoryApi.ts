import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import type { Factory } from '@/features/factory/types/Factory';
import type { FactoryApproval } from '@/features/factory/types/FactoryApproval';
import type { FactoryChangeRequest } from '@/features/factory/types/FactoryChangeRequest';
import type { FactoryRunConfig } from '@/features/factory/types/FactoryRunConfig';
import type { FactoryStepPage } from '@/features/factory/types/FactoryStepPage';
import { sessionsFetch } from '@/features/sessions/lib/sessionsFetch';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

/** Opens (or replaces) the factory chat: the agent, plus what the user asks first. */
export interface FactoryChatRequest extends FactoryRunConfig {
  request?: string;
}

const mooiPath = (projectId: string): string => `/me/projects/${encodeURIComponent(projectId)}/factory`;
const sessionsPath = (projectId: string): string => `/factories/${encodeURIComponent(projectId)}`;

const json = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) throw new Error(await apiErrorMessage(response, fallback));
  return (await response.json()) as T;
};

const post = (path: string, body?: unknown): Promise<Response> => sessionsFetch(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
});

/* Reads come from mic-mooi, the system of record; every write goes through mic-sessions, which runs the
   loop and announces each change live (`factory.updated`) to every view and to the factory chat. */

export const fetchFactories = async (): Promise<Factory[]> =>
  (await json<{ factories: Factory[] }>(await authenticatedFetch('/me/factories'), 'Could not load your factories.')).factories;

/** Null when the project has no factory yet. */
export const fetchFactory = async (projectId: string): Promise<Factory | null> => {
  const response = await authenticatedFetch(mooiPath(projectId));
  if (response.status === 404) return null;
  return json<Factory>(response, 'Could not load the factory.');
};

export const fetchFactorySteps = async (projectId: string, before?: string): Promise<FactoryStepPage> =>
  json<FactoryStepPage>(await authenticatedFetch(`${mooiPath(projectId)}/steps${before ? `?before=${encodeURIComponent(before)}` : ''}`),
    'Could not load the factory journal.');

export const fetchFactoryChangeRequests = async (projectId: string): Promise<FactoryChangeRequest[]> =>
  (await json<{ changeRequests: FactoryChangeRequest[] }>(await authenticatedFetch(`${mooiPath(projectId)}/change-requests`),
    'Could not load the change requests.')).changeRequests;

export const openFactoryChat = async (projectId: string, request: FactoryChatRequest): Promise<{ sessionId: string; factory: Factory }> =>
  json(await post(`${sessionsPath(projectId)}/chat`, request), 'Could not open the factory chat.');

export const approveFactory = async (projectId: string): Promise<FactoryApproval> =>
  json(await post(`${sessionsPath(projectId)}/definition/approve`), 'Could not approve the definition.');

export const startFactory = async (projectId: string, run: FactoryRunConfig): Promise<Factory> =>
  (await json<{ factory: Factory }>(await post(`${sessionsPath(projectId)}/start`, run), 'Could not start the factory.')).factory;

export const pauseFactory = async (projectId: string, mode: 'graceful' | 'immediate'): Promise<Factory> =>
  (await json<{ factory: Factory }>(await post(`${sessionsPath(projectId)}/pause`, { mode }), 'Could not pause the factory.')).factory;

export const resumeFactory = async (projectId: string, run: FactoryRunConfig): Promise<Factory> =>
  (await json<{ factory: Factory }>(await post(`${sessionsPath(projectId)}/resume`, run), 'Could not resume the factory.')).factory;

export const requestFactoryChange = async (projectId: string, text: string): Promise<FactoryChangeRequest> =>
  (await json<{ changeRequest: FactoryChangeRequest }>(await post(`${sessionsPath(projectId)}/change-requests`, { text }),
    'Could not queue the change request.')).changeRequest;

export const decideFactoryChange = async (projectId: string, changeId: string, accept: boolean): Promise<FactoryChangeRequest> =>
  (await json<{ changeRequest: FactoryChangeRequest }>(
    await post(`${sessionsPath(projectId)}/change-requests/${encodeURIComponent(changeId)}/decision`, { accept }),
    'Could not record the decision.')).changeRequest;

export const deleteFactory = async (projectId: string): Promise<void> => {
  const response = await sessionsFetch(sessionsPath(projectId), { method: 'DELETE' });
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not remove the factory.'));
};
