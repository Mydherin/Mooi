/**
 * The message the API meant for the player, or a fallback.
 *
 * Every endpoint answers a failure with the shared error contract, whose `message` is written to be
 * read by a person — "This repository is already in your workspace" says more than any wording the
 * client could invent from a status code. Never throws: a body that is missing, empty or not JSON
 * is simply a failure with nothing to add.
 */
export const apiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: unknown };

    return typeof body.message === 'string' && body.message.length > 0 ? body.message : fallback;
  } catch {
    return fallback;
  }
};
