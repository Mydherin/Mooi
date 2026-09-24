import { usePreviewActivity } from '@/features/sessions/hooks/usePreviewActivity';
import { PreviewDiagnostics } from './PreviewDiagnostics';
import { usePreviewFullscreen } from '@/features/sessions/hooks/usePreviewFullscreen';
import { IconButton } from '@/shared/components/IconButton';
import { cn } from '@/shared/utils/cn';
import { useState } from 'react';
import { PreviewToolbar } from './PreviewToolbar';
import type { PreviewDevice } from '@/features/sessions/types/PreviewDevice';
import { Maximize, Minimize, LoaderCircle, Monitor } from 'lucide-react';
import { PreviewFrame } from './PreviewFrame';
import { previewUrl } from '@/features/sessions/lib/previewUrl';
import type { DeploymentSnapshot } from '@/features/sessions/types/DeploymentSnapshot';

export const PreviewPanel = ({ sessionId, deployment, visible }: { sessionId: string; deployment: DeploymentSnapshot; visible: boolean }) => {
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [reload, setReload] = useState(0);
  const url = deployment.state === 'running' ? previewUrl(deployment.previewUrl, window.location.origin) : null;
  const { panelRef, expanded, fullscreen, toggle } = usePreviewFullscreen(Boolean(url) && visible);
  const activityFailed = usePreviewActivity(sessionId, visible && deployment.state === 'running');
  if (url) {
    return <div ref={panelRef} className={cn("flex h-full min-h-0 flex-col overflow-hidden bg-surface-2", expanded && "fixed inset-0 z-50 h-dvh")}>
      <PreviewToolbar device={device} onDeviceChange={setDevice} onReload={() => setReload((value) => value + 1)}>
        <IconButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={() => void toggle()} />
      </PreviewToolbar>
      <div className="mx-auto min-h-0 w-full flex-1" style={{ maxWidth: device === 'mobile' ? 390 : undefined }}>
        <PreviewFrame key={`${deployment.operationId}:${url}:${reload}`} url={url} />
      </div>
      <PreviewDiagnostics url={url} activityFailed={activityFailed} />
    </div>;
  }

  const pending = deployment.state === 'starting' || deployment.state === 'stopping';
  const message = deployment.state === 'starting' ? 'Preparing your application. Preview opens when it is ready.'
    : deployment.state === 'stopping' ? 'Stopping the application…'
    : deployment.state === 'failed' ? deployment.result?.reason?.message ?? 'Deployment failed.'
    : deployment.state === 'running' ? 'Preview requires a valid HTTP or HTTPS address on a different origin from Mooi.'
    : 'The application is stopped. Deploy again to open its preview.';

  return <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center" role="status">
    {pending ? <LoaderCircle className="size-6 animate-spin text-ink-muted" /> : <Monitor className="size-6 text-ink-muted" />}
    <p className="max-w-lg text-sm text-ink-muted [overflow-wrap:anywhere]">{message}</p>
  </div>;
};
