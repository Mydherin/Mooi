export const PreviewDiagnostics = ({ url, activityFailed }: { url: string; activityFailed: boolean }) => {
  const mixedContent = window.location.protocol === 'https:' && new URL(url).protocol === 'http:';
  return <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-line bg-surface px-3 py-2 text-xs text-ink-muted">
    {activityFailed ? <p role="status" className="mb-2">Could not renew session activity. Check your connection; this session may expire.</p> : null}
    {mixedContent ? <p role="status" className="mb-2">This HTTP preview cannot be embedded securely in HTTPS Mooi. Configure valid HTTPS for the application.</p> : null}
    <details>
      <summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-brand">Preview blank or not loading?</summary>
      <div className="space-y-2 py-2 [overflow-wrap:anywhere]">
        <p>The server verified that the application responded. This does not confirm that your browser can display it.</p>
        <p>Check that this address and its published port are reachable from your network. HTTPS requires a valid application certificate.</p>
        <p>The application’s Content-Security-Policy (frame-ancestors) and X-Frame-Options must allow embedding in Mooi. Browser privacy rules prevent Mooi from reliably detecting these blocks.</p>
        <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-block underline focus-visible:outline-2 focus-visible:outline-brand">Open application in a new tab</a>
      </div>
    </details>
  </div>;
};
