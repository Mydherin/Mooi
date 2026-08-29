import { Link } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { useGithubLinked } from '@/features/github/hooks/useGithubLinked';
import { buttonStyles } from '@/shared/styles/buttonStyles';

/**
 * The standing notice a player carries until GitHub is linked.
 *
 * Not dismissible, and shown on every screen rather than only where it blocks something: the whole
 * workspace is built on the player's repositories, so an unlinked account is not a missing option —
 * it is the reason nothing else in the application can do any work yet.
 */
export const GithubRequiredBanner = () => {
  const { linked, resolved } = useGithubLinked();

  if (!resolved || linked) {
    return null;
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-warning/30 bg-warning-soft px-4 py-2.5 lg:px-6">
      <TriangleAlert className="size-4 shrink-0 text-warning" />

      <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink">
        <span className="font-medium">Connect your GitHub account</span>
        <span className="text-ink-muted">
          {' — '}Mooi works on your repositories, so nothing runs until it is linked.
        </span>
      </p>

      <Link to={ROUTES.account} className={buttonStyles('secondary', 'sm', 'shrink-0')}>
        Connect
      </Link>
    </div>
  );
};
