/** A `docs/factory/` file as GitHub shows it on the default branch. */
export const factoryDocumentUrl = (fullName: string, branch: string, file: string): string =>
  `https://github.com/${fullName}/blob/${encodeURIComponent(branch)}/docs/factory/${file}`;
