import { IntegrationChip } from '@/features/marketing/components/IntegrationChip';
import { integrations } from '@/features/marketing/data/integrations';
import { Container } from '@/shared/components/Container';

export const IntegrationsSection = () => (
  <section className="border-t border-line py-16">
    <Container className="flex flex-col items-center gap-8 text-center">
      <p className="text-sm font-medium text-ink-subtle">
        Works with the tools already in your stack
      </p>

      <ul className="flex flex-wrap items-center justify-center gap-2.5">
        {integrations.map((integration) => (
          <IntegrationChip key={integration.id} integration={integration} />
        ))}
      </ul>
    </Container>
  </section>
);
