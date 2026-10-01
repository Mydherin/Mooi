/** A GitHub repository linked as a recipe marketplace. A reference only: its recipes are read live. */
export interface RecipeMarketplace {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string | null;
  htmlUrl: string | null;
  addedAt: string;
}
