export const WORKSPACE_PANES = ['conversation', 'changes', 'files', 'preview', 'trace', 'workspace'] as const;

export type WorkspacePane = typeof WORKSPACE_PANES[number];

export const isWorkspacePane = (id: string): id is WorkspacePane => (WORKSPACE_PANES as readonly string[]).includes(id);
