/** One `recipes/<slug>.md` file: its front matter's name and description, and its Markdown body. */
export interface Recipe {
  slug: string;
  path: string;
  name: string;
  description: string | null;
  content: string;
  htmlUrl: string | null;
}
