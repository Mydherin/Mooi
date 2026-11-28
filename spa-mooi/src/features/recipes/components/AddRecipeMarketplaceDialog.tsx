import { useRef, useState, type FormEvent } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/shared/components/actions/Button';
import { Alert } from '@/shared/components/feedback/Alert';
import { TextField } from '@/shared/components/forms/TextField';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';

interface AddRecipeMarketplaceDialogProps {
  busy: boolean;
  actionError: string | null;
  onClose: () => void;
  onAdd: (url: string) => Promise<boolean>;
}

const FORM_ID = 'add-recipe-marketplace';

/** Links a GitHub repository with a `recipes/` folder of Markdown recipes, public or private. */
export const AddRecipeMarketplaceDialog = ({ busy, actionError, onClose, onAdd }: AddRecipeMarketplaceDialogProps) => {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim() || busy) return;
    void onAdd(url.trim()).then((added) => { if (added) onClose(); });
  };

  return (
    <Dialog open onClose={onClose} title="Add recipe marketplace" dismissible={!busy} initialFocus={input}
      description="A GitHub repository your account can read, with a recipes folder of Markdown recipes."
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="brand" type="submit" form={FORM_ID} loading={busy} disabled={!url.trim()}>Add marketplace</Button>
      </>}>
      <form id={FORM_ID} className="flex flex-col gap-4" onSubmit={submit}>
        <TextField ref={input} label="Repository URL" type="url" inputMode="url" value={url} onChange={setUrl} maxLength={512} required
          autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="go" placeholder="https://github.com/owner/agent-recipes"
          leading={<Link2 aria-hidden className="size-4" />} />
        <div className="rounded-control border border-line bg-surface-2 px-4 py-3 text-footnote text-ink-muted">
          <p className="font-semibold text-ink">Expected layout</p>
          <pre className="mt-2 overflow-x-auto font-mono text-mono text-ink-subtle">{'recipes/\n  google_sso_login.md\n  rate_limiting.md'}</pre>
          <p className="mt-2">Each recipe starts with a front matter holding its <code className="font-mono">name</code> and <code className="font-mono">description</code>.</p>
        </div>
        {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
      </form>
    </Dialog>
  );
};
