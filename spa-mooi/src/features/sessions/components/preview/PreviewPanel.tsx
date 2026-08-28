import { Server } from 'lucide-react';
import { PreviewFrame } from '@/features/sessions/components/preview/PreviewFrame';
import { PreviewToolbar } from '@/features/sessions/components/preview/PreviewToolbar';
import { StatusDot } from '@/shared/components/StatusDot';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const previewUrl = 'https://checkout-flow.aurora.mooi.app';

export const PreviewPanel = () => {
  const previewDevice = useWorkspaceStore((state) => state.previewDevice);
  const setPreviewDevice = useWorkspaceStore((state) => state.setPreviewDevice);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-2">
      <PreviewToolbar url={previewUrl} device={previewDevice} onDeviceChange={setPreviewDevice} />
      <PreviewFrame device={previewDevice} />

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-ink-subtle">
        <span className="flex items-center gap-2">
          <StatusDot tone="success" pulse />
          Running · rebuilt 12s ago
        </span>
        <span className="flex items-center gap-1.5">
          <Server className="size-3.5" />
          session runtime
        </span>
      </div>
    </div>
  );
};
