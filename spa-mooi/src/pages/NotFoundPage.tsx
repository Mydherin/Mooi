import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { Button } from '@/shared/components/actions/Button';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { Page } from '@/shared/components/layout/Page';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PageSection } from '@/shared/components/layout/PageSection';
import { buttonStyles } from '@/shared/styles/buttonStyles';

/** Back returns to where the user came from when the app has history; a direct visit only offers Projects. */
const hasHistory = () => typeof window.history.state?.idx === 'number' && window.history.state.idx > 0;

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <Page width="narrow">
      <PageHeader title="Page not found" largeTitle={false} />
      <PageSection>
        <EmptyState icon={Compass} title="This page does not exist"
          description="The route you followed is not part of the workspace. Head back and pick a project.">
          {hasHistory() ? <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>Back</Button> : null}
          <Link to={ROUTES.projects} className={buttonStyles('brand', 'md')}>Go to projects</Link>
        </EmptyState>
      </PageSection>
    </Page>
  );
};
