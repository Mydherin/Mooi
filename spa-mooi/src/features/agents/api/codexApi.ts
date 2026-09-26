import { sessionsFetch } from '@/features/sessions/lib/sessionsFetch';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';
import type { CodexAuthorization } from '@/features/agents/types/CodexAuthorization';

const path = '/agents/codex/authorization';

export const startCodexAuthorization = async (name: string): Promise<CodexAuthorization> => {
  const response = await sessionsFetch(`${path}?name=${encodeURIComponent(name)}`, { method: 'POST' });
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not start Codex login.'));
  return response.json();
};

export const pollCodexAuthorization = async (id: string): Promise<string> => {
  const response = await sessionsFetch(`${path}/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not verify Codex login.'));
  return (await response.json()).status;
};

export const cancelCodexAuthorization = async (id: string): Promise<void> => {
  await sessionsFetch(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE' });
};
