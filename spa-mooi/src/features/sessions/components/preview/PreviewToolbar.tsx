import { ExternalLink, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import type { PreviewDevice } from '@/features/sessions/types/PreviewDevice';
import { IconButton } from '@/shared/components/IconButton';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import type { SegmentItem } from '@/shared/types/SegmentItem';

interface PreviewToolbarProps {
  url: string;
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
}

const devices: SegmentItem[] = [
  { id: 'desktop', label: '', icon: Monitor },
  { id: 'mobile', label: '', icon: Smartphone },
];

export const PreviewToolbar = ({ url, device, onDeviceChange }: PreviewToolbarProps) => (
  <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
    <IconButton icon={RefreshCw} label="Reload preview" className="size-9" />

    <span className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs text-ink-subtle">
      {url}
    </span>

    <SegmentedControl
      items={devices}
      value={device}
      onChange={(id) => onDeviceChange(id as PreviewDevice)}
      className="hidden sm:inline-flex"
    />

    <IconButton icon={ExternalLink} label="Open preview in a new tab" className="size-9" />
  </div>
);
