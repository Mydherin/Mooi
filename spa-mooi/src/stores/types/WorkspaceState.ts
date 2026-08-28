import type { PreviewDevice } from '@/features/sessions/types/PreviewDevice';
import type { WorkspacePane } from '@/features/sessions/types/WorkspacePane';

export interface WorkspaceState {
  activePane: WorkspacePane;
  setActivePane: (pane: WorkspacePane) => void;
  previewDevice: PreviewDevice;
  setPreviewDevice: (device: PreviewDevice) => void;
}
