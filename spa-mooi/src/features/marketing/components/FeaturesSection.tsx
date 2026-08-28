import { features } from '@/features/marketing/data/features';
import { FeatureCard } from '@/features/marketing/components/FeatureCard';
import { Container } from '@/shared/components/Container';
import { SectionHeading } from '@/shared/components/SectionHeading';

export const FeaturesSection = () => (
  <section id="product" className="scroll-mt-20 py-20 sm:py-24">
    <Container>
      <SectionHeading
        eyebrow="Product"
        title="Everything a change needs, in one session"
        description="Connect a repository, describe the change, and follow the agent from the first file read to the production deploy."
      />

      <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </ul>
    </Container>
  </section>
);
