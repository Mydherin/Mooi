export const PreviewDiagnostics = ({ url, activityFailed }: { url: string; activityFailed: boolean }) => {
  const mixedContent = window.location.protocol === 'https:' && new URL(url).protocol === 'http:';
  return <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-line bg-surface px-3 py-2 text-xs text-ink-muted">
    {activityFailed ? <p role="status" className="mb-2">Could not renew session activity. Check your connection; this session may expire.</p> : null}
    {mixedContent ? <p role="status" className="mb-2">This HTTP preview cannot be embedded securely in HTTPS Mooi. Configure an HTTPS preview base URL.</p> : null}
    <details>
      <summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-brand">Preview blank or not loading?</summary>
      <div className="space-y-2 py-2 [overflow-wrap:anywhere]">
        <p>The server verified that the application responded. Mooi serves it through its own preview proxy at a private address that changes on every deploy and stops working once the deployment stops.</p>
        <p>If the page stays blank, reload the preview. In production the preview domain needs wildcard DNS and TLS routed to Mooi.</p>
        <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-block underline focus-visible:outline-2 focus-visible:outline-brand">Open application in a new tab</a>
      </div>
    </details>
  </div>;
};
