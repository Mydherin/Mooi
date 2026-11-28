import { GithubConnectButton } from '@/features/github/components/GithubConnectButton';
import { useGithubConnection } from '@/features/github/hooks/useGithubConnection';
import { GithubMark } from '@/shared/components/brand/GithubMark';
import { Alert } from '@/shared/components/feedback/Alert';

interface GithubGateCardProps {
  title: string;
  description: string;
}

/**
 * What a screen shows instead of its own content while GitHub is not linked.
 *
 * It replaces the screen rather than sitting beside it: offering filters, search or an empty grid
 * next to this card would suggest there is something to do first, when connecting is the only move
 * available.
 */
export const GithubGateCard = ({ title, description }: GithubGateCardProps) => {
  const { status, error, connect } = useGithubConnection();

  return (
    <section className="relative flex animate-fade-up flex-col items-center overflow-hidden rounded-card border border-line bg-surface px-5 py-10 text-center shadow-card sm:px-10 sm:py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dot-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <span className="relative flex size-14 items-center justify-center rounded-panel bg-contrast text-contrast-ink shadow-raised">
        <GithubMark className="size-7" />
      </span>
      <h2 className="relative mt-5 max-w-md text-title text-balance text-ink">{title}</h2>
      <p className="relative mt-2 max-w-md text-callout text-ink-muted">{description}</p>
      <div className="relative mt-7 w-full sm:w-auto">
        <GithubConnectButton onConnect={connect} busy={status === 'connecting'} fullWidth />
      </div>
      {status === 'error' && error ? <Alert tone="danger" className="relative mt-4 w-full max-w-md text-left">{error}</Alert> : null}
    </section>
  );
};
