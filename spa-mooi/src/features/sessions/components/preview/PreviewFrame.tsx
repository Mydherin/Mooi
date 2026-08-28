import { previewDocument } from '@/features/sessions/data/previewDocument';
import type { PreviewDevice } from '@/features/sessions/types/PreviewDevice';
import { cn } from '@/shared/utils/cn';

interface PreviewFrameProps {
  device: PreviewDevice;
}

export const PreviewFrame = ({ device }: PreviewFrameProps) => (
  <div className="min-h-0 flex-1 p-3 lg:p-4">
    <div className={cn('h-full', device === 'mobile' ? 'mx-auto w-full max-w-[390px]' : 'w-full')}>
      <iframe
        title="Session preview"
        sandbox=""
        srcDoc={previewDocument}
        className="h-full w-full rounded-xl border border-line bg-white"
      />
    </div>
  </div>
);
