import { ShowcaseChat } from '@/features/marketing/components/showcase/ShowcaseChat';
import { ShowcaseChrome } from '@/features/marketing/components/showcase/ShowcaseChrome';
import { ShowcaseStage } from '@/features/marketing/components/showcase/ShowcaseStage';
import { Container } from '@/shared/components/Container';

export const WorkspaceShowcase = () => (
  <Container className="-mt-6 overflow-x-clip pb-20 sm:pb-24">
    <div className="relative mx-auto max-w-5xl">
      <div
        aria-hidden
        className="absolute -inset-x-10 -top-6 bottom-10 -z-10 rounded-[40px] bg-brand/20 blur-[90px]"
      />

      <div className="flex h-[420px] flex-col overflow-hidden rounded-[20px] border border-line bg-surface shadow-2xl shadow-brand/10">
        <ShowcaseChrome />

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,38%)_1fr]">
          <ShowcaseChat />
          <ShowcaseStage />
        </div>
      </div>
    </div>
  </Container>
);
