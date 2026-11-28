import { PlatformEnvironmentCard } from '@/features/platform/components/PlatformEnvironmentCard';
import { ProductionHero } from '@/features/production/components/ProductionHero';
import { ProductionHistoryCard } from '@/features/production/components/ProductionHistoryCard';
import { ProductionStats } from '@/features/production/components/ProductionStats';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import type { ProductionHealth } from '@/features/production/types/ProductionHealth';
import type { ProductionHealthState } from '@/features/production/types/ProductionHealthState';
import type { ProductionOverview } from '@/features/production/types/ProductionOverview';
import type { ProductionStage } from '@/features/production/types/ProductionStage';
import { Alert } from '@/shared/components/feedback/Alert';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { OperationOutput } from '@/features/production/components/operation/OperationOutput';

interface ProductionOverviewPanelProps {
  overview: ProductionOverview | null;
  error: string | null;
  onRetry: () => void;
  stage: ProductionStage;
  hasChat: boolean;
  missingVariables: number;
  releaseTag: string | null;
  latest: ProductionDeployment | undefined;
  health: { state: ProductionHealthState; health: ProductionHealth | null; error: string | null };
  history: { deployments: ProductionDeployment[]; loading: boolean; error: string | null };
  deploying: boolean;
  onSetup: () => void;
  onDeploy: () => void;
  onOpenChat: () => void;
  onOpenConsole: () => void;
  onFix: () => void;
  onEnvironment: () => void;
  onOpenDeployment: (deployment: ProductionDeployment) => void;
  onRedeploy: (deployment: ProductionDeployment) => void;
}

/** The landing tab: the lifecycle card, then numbers, environment and history once there is something to show. */
export const ProductionOverviewPanel = ({ overview, error, onRetry, stage, hasChat, missingVariables, releaseTag, latest,
  health, history, deploying, onSetup, onDeploy, onOpenChat, onOpenConsole, onFix, onEnvironment, onOpenDeployment, onRedeploy }: ProductionOverviewPanelProps) => {
  const started = Boolean(overview?.configured || history.deployments.length > 0 || overview?.environment.length);

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-gutter py-5 pb-[calc(1.25rem+var(--safe-bottom))] lg:py-8">
        {!overview ? error ? <ErrorState description={error} onRetry={onRetry} /> : <div aria-busy className="flex flex-col gap-4">
          <Skeleton className="h-56 rounded-panel" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-22 rounded-card" />)}</div>
        </div> : <>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <ProductionHero stage={stage} hasChat={hasChat} missingVariables={missingVariables} releaseTag={releaseTag}
            onSetup={onSetup} onDeploy={onDeploy} onOpenChat={onOpenChat} onOpenConsole={onOpenConsole} onFix={onFix} onEnvironment={onEnvironment} />

          {started ? <>
            <ProductionStats overview={overview} latest={latest} healthState={health.state} health={health.health} healthError={health.error} />
            {health.health?.state === 'unhealthy' && health.health.output ? <Alert tone="danger" title="status.sh reported a problem">
              <OperationOutput content={health.health.output} kind="log" label="status.sh output" />
            </Alert> : null}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
              <PlatformEnvironmentCard variables={overview.environment} onEdit={onEnvironment}
                emptyDescription="No variables yet. The agent asks for them while it prepares the scripts." />
              <ProductionHistoryCard deployments={history.deployments} loading={history.loading} error={history.error}
                canRedeploy={overview.configured && missingVariables === 0 && stage !== 'deploying' && !deploying}
                onOpen={onOpenDeployment} onRedeploy={onRedeploy} />
            </div>
          </> : null}
        </>}
      </div>
    </div>
  );
};
