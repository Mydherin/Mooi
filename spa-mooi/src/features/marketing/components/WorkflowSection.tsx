import { WorkflowStep } from '@/features/marketing/components/WorkflowStep';
import { workflowSteps } from '@/features/marketing/data/workflowSteps';
import { Container } from '@/shared/components/Container';
import { SectionHeading } from '@/shared/components/SectionHeading';

export const WorkflowSection = () => (
  <section id="workflow" className="scroll-mt-20 border-t border-line py-20 sm:py-24">
    <Container>
      <SectionHeading
        eyebrow="Workflow"
        title="From repository to production in five moves"
        description="Every session follows the same rhythm, so the next change is never a new process."
      />

      <ol className="mt-14 grid gap-10 border-l border-line pl-8 lg:grid-cols-5 lg:gap-6 lg:border-l-0 lg:pl-0">
        {workflowSteps.map((step, index) => (
          <WorkflowStep key={step.id} step={step} index={index} />
        ))}
      </ol>
    </Container>
  </section>
);
