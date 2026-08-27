import { features } from '@/features/landing/data/features';
import { FeatureCard } from '@/features/landing/components/FeatureCard';
import { Container } from '@/shared/components/Container';
import { SectionHeading } from '@/shared/components/SectionHeading';

export const FeaturesSection = () => (
  <section id="features" className="scroll-mt-16 py-20 sm:py-28">
    <Container>
      <SectionHeading
        eyebrow="Features"
        title="Everything wired, nothing in the way"
        description="A minimal surface with the decisions already made, so the first feature is the first thing you write."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </div>
    </Container>
  </section>
);
