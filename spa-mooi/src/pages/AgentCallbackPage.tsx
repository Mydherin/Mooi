import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { completeAgentAuthorization } from '@/features/agents/api/agentsApi';
import { Card } from '@/shared/components/Card';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { useAgentsStore } from '@/stores/agentsStore';

/**
 * Where an agent provider sends the player back.
 *
 * An authenticated route, same reasoning as `GithubCallbackPage`: landing inside the application
 * means the browser still holds a Mooi access token, so the authorization code is redeemed as a
 * known player and the link is bound to them. Unlike GitHub, a success returns to the account
 * screen — this callback finishes a connection, not a workspace import, so there is nowhere else
 * the player was waiting to reach.
 */
export const AgentCallbackPage = () => {
  const navigate = useNavigate();
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const [failure, setFailure] = useState<string | null>(null);
  const redeemed = useRef(false);

  useEffect(() => {
    // The code is single-use and StrictMode mounts every effect twice, so the second run would
    // redeem a code the first run already spent and report a failure for a flow that worked.
    if (redeemed.current) {
      return;
    }
    redeemed.current = true;

    const denied = searchParams.get('error');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!provider) {
      setFailure('This link is missing its provider.');
      return;
    }

    if (denied) {
      setFailure(
        denied === 'access_denied'
          ? 'You declined the authorization.'
          : 'The provider refused the authorization.',
      );
      return;
    }

    if (!code || !state) {
      setFailure('The provider did not return a valid authorization.');
      return;
    }

    useAgentsStore.getState().setStatus('loading');
    const storageKey = `agent-oauth-name:${state}`;
    const name = sessionStorage.getItem(storageKey);
    sessionStorage.removeItem(storageKey);
    if (!name) {
      setFailure('The account title is missing. Please start the connection again.');
      return;
    }
    completeAgentAuthorization(provider, code, state, name)
      .then((connection) => {
        useAgentsStore.getState().upsertConnection(connection);
        navigate(ROUTES.account, { replace: true });
      })
      .catch(() => {
        setFailure('We could not link this provider. Please try again.');
      });
  }, [navigate, provider, searchParams]);

  if (failure) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 lg:px-6">
        <Card className="mx-auto w-full max-w-md p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-[14px] bg-danger-soft text-danger">
            <TriangleAlert className="size-5" />
          </span>

          <h1 className="mt-6 text-lg font-extrabold tracking-[-0.03em] text-ink">
            The agent was not connected
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{failure}</p>

          <Link to={ROUTES.account} className={buttonStyles('primary', 'md', 'mt-7 w-full')}>
            Back to account
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-24 text-center lg:px-6">
      <LoaderCircle className="size-6 animate-spin text-brand" />
      <p className="mt-4 text-sm text-ink-muted">Connecting your agent…</p>
    </div>
  );
};
