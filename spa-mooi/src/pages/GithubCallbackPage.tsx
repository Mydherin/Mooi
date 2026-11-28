import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { completeGithubAuthorization } from '@/features/github/api/githubApi';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PageSection } from '@/shared/components/layout/PageSection';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { useGithubStore } from '@/stores/githubStore';
import { Spinner } from '@/shared/components/feedback/Spinner';

/**
 * Where GitHub sends the player back.
 *
 * It is an authenticated route on purpose: landing inside the application means the browser still
 * holds a Mooi access token, so the authorization code is redeemed as a known player and the link
 * is bound to them. An unauthenticated hit never reaches this page — the route guard sends it to
 * the login screen first.
 *
 * A success lands on the projects screen rather than back on the account screen: linking GitHub is what
 * the whole workspace was waiting for, so the player is returned to the place where it now works.
 */
export const GithubCallbackPage = () => {
  const navigate = useNavigate();
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

    if (denied) {
      setFailure(
        denied === 'access_denied'
          ? 'You declined the authorization on GitHub.'
          : 'GitHub refused the authorization.',
      );
      return;
    }

    if (!code || !state) {
      setFailure('GitHub did not return a valid authorization.');
      return;
    }

    useGithubStore.getState().setStatus('connecting');
    completeGithubAuthorization(code, state)
      .then((connection) => {
        useGithubStore.getState().setConnection(connection);
        navigate(ROUTES.projects, { replace: true });
      })
      .catch(() => {
        setFailure('We could not link your GitHub account. Please try again.');
      });
  }, [navigate, searchParams]);

  return (
    <Page width="narrow">
      <PageHeader title="GitHub" largeTitle={false} />
      <PageSection>
        {failure ? (
          <EmptyState icon={TriangleAlert} title="GitHub was not connected" description={failure}>
            <Link to={ROUTES.account} className={buttonStyles('primary', 'md')}>Back to account</Link>
          </EmptyState>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <Spinner className="size-6 text-brand" />
            <p role="status" className="text-callout text-ink-muted">Linking your GitHub account…</p>
          </div>
        )}
      </PageSection>
    </Page>
  );
};
