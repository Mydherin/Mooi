export const PreviewFrame = ({ url }: { url: string }) => (
  <iframe
    src={url}
    title="Deployed application preview"
    referrerPolicy="no-referrer"
    className="h-full min-h-0 w-full border-0 bg-white"
  />
);
