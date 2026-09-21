import { useAgentConnections } from '@/features/agents/hooks/useAgentConnections';
import { useGithubLinked } from '@/features/github/hooks/useGithubLinked';
import { cn } from '@/shared/utils/cn';

interface ConnectionPillProps {
  label: string;
  linked: boolean;
}

const ConnectionPill = ({ label, linked }: ConnectionPillProps) => (
  <span className="hidden items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-extrabold text-ink-muted sm:inline-flex">
    <span aria-hidden className={cn('size-1.5 rounded-full', linked ? 'bg-success-dot' : 'bg-line-strong')} />
    {label} {linked ? 'linked' : 'not linked'}
  </span>
);

/**
 * Whether the two connections the application depends on are in place, read at a glance.
 *
 * Nothing is rendered until each side has resolved: "not linked" before the answer arrives would
 * accuse a player who linked weeks ago.
 */
export const AppConnectionPills = () => {
  const { linked: githubLinked, resolved: githubResolved } = useGithubLinked();
  const { providers, connections, status } = useAgentConnections();
  const agentsResolved = status === 'ready' || status === 'error';
  const provider = providers[0];

  return (
    <>
      {githubResolved ? <ConnectionPill label="GitHub" linked={githubLinked} /> : null}
      {agentsResolved && provider ? (
        <ConnectionPill
          label={provider.label}
          linked={connections.some((connection) => connection.provider === provider.id)}
        />
      ) : null}
    </>
  );
};
