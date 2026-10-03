import { previewPermissions } from '@/features/sessions/lib/previewPermissions';

/** The app runs under its proxied capability path, with delegated device permissions. */
export const PreviewFrame = ({ url }: { url: string }) => (
  <iframe
    src={url}
    title="Deployed application preview"
    allow={previewPermissions}
    allowFullScreen
    referrerPolicy="no-referrer"
    className="h-full min-h-0 w-full border-0 bg-white"
  />
);
