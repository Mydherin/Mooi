import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import type { Project } from '@/features/projects/types/Project';
import type { ProjectSettings } from '@/features/projects/types/ProjectSettings';
import type { ProjectsResponse } from '@/features/projects/types/ProjectsResponse';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

const PROJECTS_PATH = '/me/projects';

export const fetchProjects = async (): Promise<Project[]> => {
  const response = await authenticatedFetch(PROJECTS_PATH);

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Could not load your projects.'));
  }

  const body = (await response.json()) as ProjectsResponse;

  return body.projects;
};

/**
 * Adds a repository by its `owner/name` plus the player's own settings, and nothing else.
 *
 * The client sends no GitHub metadata: the API reads the repository from GitHub with the player's
 * own grant, which both proves the player can reach it and keeps the stored description, branch and
 * visibility authoritative rather than whatever a browser claimed.
 */
export const addProject = async (fullName: string, settings: ProjectSettings): Promise<Project> => {
  const response = await authenticatedFetch(PROJECTS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, ...settings }),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Could not add this repository.'));
  }

  return (await response.json()) as Project;
};

export const updateProject = async (projectId: string, settings: ProjectSettings): Promise<Project> => {
  const response = await authenticatedFetch(`${PROJECTS_PATH}/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Could not update this project.'));
  }

  return (await response.json()) as Project;
};

export const removeProject = async (projectId: string): Promise<void> => {
  const response = await authenticatedFetch(`${PROJECTS_PATH}/${projectId}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Could not remove this project.'));
  }
};
