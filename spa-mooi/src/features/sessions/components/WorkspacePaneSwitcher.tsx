import { AppWindow, FileDiff, MessagesSquare } from 'lucide-react';
import type { WorkspacePane } from '@/features/sessions/types/WorkspacePane';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import type { SegmentItem } from '@/shared/types/SegmentItem';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const items: SegmentItem[] = [
  { id: 'chat', label: 'Chat', icon: MessagesSquare },
  { id: 'preview', label: 'Preview', icon: AppWindow },
  { id: 'changes', label: 'Changes', icon: FileDiff },
];

export const WorkspacePaneSwitcher = () => {
  const activePane = useWorkspaceStore((state) => state.activePane);
  const setActivePane = useWorkspaceStore((state) => state.setActivePane);

  return (
    <SegmentedControl
      items={items}
      value={activePane}
      onChange={(id) => setActivePane(id as WorkspacePane)}
      className="flex w-full"
    />
  );
};
