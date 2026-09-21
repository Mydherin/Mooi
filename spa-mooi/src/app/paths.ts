export const projectPath = (projectId: string): string => `/projects/${projectId}`;

export const agentCallbackPath = (provider: string): string => `/account/agents/${provider}/callback`;

export const sessionPath = (projectId: string, sessionId: string): string =>
  `/projects/${projectId}/sessions/${sessionId}`;
