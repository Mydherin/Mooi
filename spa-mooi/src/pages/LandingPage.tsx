import { CtaSection } from '@/features/landing/components/CtaSection';
import { FeaturesSection } from '@/features/landing/components/FeaturesSection';
import { Hero } from '@/features/landing/components/Hero';
import { StackSection } from '@/features/landing/components/StackSection';

export const LandingPage = () => (
  <>
    <Hero />
    <FeaturesSection />
    <StackSection />
    <CtaSection />
  </>
);
