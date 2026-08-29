/**
 * A GitHub repository the linked account can reach, as the API reports it.
 *
 * Metadata only, and nothing that grows: this shape feeds a picker and, once imported, a project
 * card. The code itself is never carried through the application.
 */
export interface GithubRepository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string | null;
  htmlUrl: string | null;
  language: string | null;
  stars: number;
  pushedAt: string | null;
}
