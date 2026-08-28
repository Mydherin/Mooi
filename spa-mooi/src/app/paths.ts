export const projectPath = (projectId: string): string => `/projects/${projectId}`;

export const sessionPath = (projectId: string, sessionId: string): string =>
  `/projects/${projectId}/sessions/${sessionId}`;
