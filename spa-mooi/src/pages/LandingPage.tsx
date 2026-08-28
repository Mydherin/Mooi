import { CtaSection } from '@/features/marketing/components/CtaSection';
import { FaqSection } from '@/features/marketing/components/FaqSection';
import { FeaturesSection } from '@/features/marketing/components/FeaturesSection';
import { Hero } from '@/features/marketing/components/Hero';
import { IntegrationsSection } from '@/features/marketing/components/IntegrationsSection';
import { WorkflowSection } from '@/features/marketing/components/WorkflowSection';
import { WorkspaceShowcase } from '@/features/marketing/components/showcase/WorkspaceShowcase';

export const LandingPage = () => (
  <>
    <Hero />
    <WorkspaceShowcase />
    <FeaturesSection />
    <WorkflowSection />
    <IntegrationsSection />
    <FaqSection />
    <CtaSection />
  </>
);
