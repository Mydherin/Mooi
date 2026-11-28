import type { AuthPlayer } from '@/features/auth/types/AuthPlayer';
import { Avatar } from '@/shared/components/data-display/Avatar';
import { Badge } from '@/shared/components/data-display/Badge';
import { TruncatedText } from '@/shared/components/data-display/TruncatedText';
import { formatDate } from '@/shared/utils/formatDate';

interface ProfileSummaryProps {
  player: AuthPlayer;
}

/** Who is signed in, as the Google identity tells it: it cannot be edited from Mooi. */
export const ProfileSummary = ({ player }: ProfileSummaryProps) => (
  <section aria-label="Profile" className="min-w-0">
    <div className="flex min-w-0 items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <Avatar src={player.avatarUrl} name={player.username} size="lg" />
      <div className="min-w-0 flex-1">
        <TruncatedText text={player.username} className="text-headline text-ink" />
        <TruncatedText text={player.email} className="mt-0.5 text-callout text-ink-muted" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={player.role === 'admin' ? 'brand' : 'neutral'} className="capitalize">{player.role}</Badge>
          <span className="text-footnote text-ink-subtle">On Mooi since {formatDate(player.createdAt)}</span>
        </div>
      </div>
    </div>
    <p className="px-1 pt-1.5 text-footnote text-ink-muted">Name, email and picture come from your Google account.</p>
  </section>
);
