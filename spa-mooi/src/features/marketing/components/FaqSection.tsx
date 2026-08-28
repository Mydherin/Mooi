import { FaqItem } from '@/features/marketing/components/FaqItem';
import { faqs } from '@/features/marketing/data/faqs';
import { Container } from '@/shared/components/Container';
import { SectionHeading } from '@/shared/components/SectionHeading';

export const FaqSection = () => (
  <section id="faq" className="scroll-mt-20 border-t border-line py-20 sm:py-24">
    <Container>
      <SectionHeading
        eyebrow="FAQ"
        title="The questions that come up first"
        description="How sessions touch your repository, which providers run them, and where the preview lives."
      />

      <ul className="mx-auto mt-12 flex max-w-3xl flex-col gap-3">
        {faqs.map((entry) => (
          <FaqItem key={entry.id} entry={entry} />
        ))}
      </ul>
    </Container>
  </section>
);
