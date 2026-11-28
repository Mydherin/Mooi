import { useEffect, useState } from 'react';
import { Check, Plus, Rocket, Tag } from 'lucide-react';
import { fetchProductionReleases } from '@/features/production/api/productionApi';
import { nextReleaseTag } from '@/features/production/lib/nextReleaseTag';
import { RELEASE_TAG_PATTERN } from '@/features/production/lib/releaseTagPattern';
import type { GithubRelease } from '@/features/production/types/GithubRelease';
import type { ReleaseChoice } from '@/features/production/types/ReleaseChoice';
import { Button } from '@/shared/components/actions/Button';
import { Alert } from '@/shared/components/feedback/Alert';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { TextField } from '@/shared/components/forms/TextField';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';
import { cn } from '@/shared/utils/cn';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface ProductionReleaseDialogProps {
  projectId: string;
  defaultBranch: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (choice: ReleaseChoice) => void;
}

/** Production always deploys an immutable GitHub release: an existing one, or a new one from the default branch. */
export const ProductionReleaseDialog = ({ projectId, defaultBranch, busy, error, onClose, onSelect }: ProductionReleaseDialogProps) => {
  const [releases, setReleases] = useState<GithubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'existing' | 'create'>('existing');
  const [selected, setSelected] = useState('');
  const [tag, setTag] = useState('');

  useEffect(() => {
    let active = true;
    fetchProductionReleases(projectId).then((items) => {
      if (!active) return;
      setReleases(items);
      setSelected(items[0]?.tag ?? '');
      setTag(nextReleaseTag(items[0]?.tag));
      if (items.length === 0) setMode('create');
    }).catch((failure: Error) => { if (active) setLoadError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  const choice: ReleaseChoice = mode === 'existing' ? { tag: selected, create: false } : { tag: tag.trim(), create: true };
  const valid = choice.tag.length > 0 && (mode === 'existing' || RELEASE_TAG_PATTERN.test(choice.tag));
  const modes = [
    { id: 'existing', label: 'Existing release', icon: Tag },
    { id: 'create', label: 'New release', icon: Plus },
  ];

  return <Dialog open onClose={onClose} dismissible={!busy} title="Deploy a release"
    description="Production always runs an immutable GitHub release. Redeploy a published version or publish a new one."
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button variant="brand" icon={Rocket} loading={busy} disabled={!valid || loading} onClick={() => onSelect(choice)}>
        {mode === 'create' ? 'Publish and deploy' : 'Deploy'}
      </Button></>}>
    <div className="flex min-w-0 flex-col gap-4">
      {releases.length > 0 ? <SegmentedControl items={modes} value={mode} onChange={(next) => setMode(next as 'existing' | 'create')} ariaLabel="Release source" /> : null}

      {loading ? <Spinner label="Loading releases…" />
        : mode === 'existing' ? <ul role="radiogroup" aria-label="Published releases"
          className="flex max-h-[min(18rem,40dvh)] min-w-0 flex-col gap-1.5 overflow-y-auto overscroll-contain">
          {releases.map((release) => <li key={release.tag}>
            <button type="button" role="radio" aria-checked={selected === release.tag} disabled={busy} onClick={() => setSelected(release.tag)}
              className={cn('flex min-h-14 w-full min-w-0 items-center gap-3 rounded-control border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand',
                selected === release.tag ? 'border-ink bg-surface' : 'border-line active:bg-surface-2 hover-device:hover:bg-surface-2')}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-callout font-semibold text-ink">{release.tag}</span>
                <span className="block truncate text-footnote text-ink-muted">{release.name !== release.tag ? `${release.name} · ` : ''}
                  {release.publishedAt ? `Published ${formatRelativeTime(release.publishedAt)}` : 'Published'}</span>
              </span>
              {selected === release.tag ? <Check aria-hidden className="size-4 shrink-0 text-ink" /> : null}
            </button>
          </li>)}
        </ul> : <TextField label="Version" value={tag} onChange={setTag} disabled={busy} placeholder="v1.0.0" mono
          autoCapitalize="none" autoComplete="off" spellCheck={false} enterKeyHint="go"
          error={tag.length > 0 && !valid ? 'Start with a letter or digit; use only letters, digits, dots, dashes and underscores (e.g. v1.2.3).' : undefined}
          hint={`Published on GitHub from the latest ${defaultBranch ?? 'default branch'} commit when the deployment starts.`} />}
      {loadError || error ? <Alert tone="danger">{error ?? loadError}</Alert> : null}
    </div>
  </Dialog>;
};
