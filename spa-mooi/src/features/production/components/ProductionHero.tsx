import { KeyRound, MessagesSquare, Rocket, Sparkles, Terminal } from 'lucide-react';
import { OperationStatusCard } from '@/features/production/components/operation/OperationStatusCard';
import { OperationSteps, type OperationStep } from '@/features/production/components/operation/OperationSteps';
import { PRODUCTION_STAGE_VIEWS } from '@/features/production/lib/productionStageView';
import type { ProductionStage } from '@/features/production/types/ProductionStage';
import { Button } from '@/shared/components/actions/Button';

interface ProductionHeroProps {
  stage: ProductionStage;
  hasChat: boolean;
  missingVariables: number;
  releaseTag: string | null;
  onSetup: () => void;
  onDeploy: () => void;
  onOpenChat: () => void;
  onOpenConsole: () => void;
  onFix: () => void;
  onEnvironment: () => void;
}

const STEPS: OperationStep[] = [
  { title: 'Describe it', description: 'Pick an agent and explain how the project reaches production.' },
  { title: 'Prepare it together', description: 'The agent writes DEPLOYMENT.md, deploy.sh and status.sh and asks for any secret it needs.' },
  { title: 'Deploy a release', description: 'Choose a GitHub release, follow the console and keep an eye on its status.' },
];

/** Where the project's production stands and the single next step; secondary actions live in the header. */
export const ProductionHero = ({ stage, hasChat, missingVariables, releaseTag, onSetup, onDeploy, onOpenChat,
  onOpenConsole, onFix, onEnvironment }: ProductionHeroProps) => {
  const view = PRODUCTION_STAGE_VIEWS[stage];
  const blocked = missingVariables > 0 && (stage === 'ready' || stage === 'failed' || stage === 'live');

  return (
    <OperationStatusCard key={stage} icon={view.icon} tone={view.tone} busy={stage === 'deploying'}
      title={stage === 'live' && releaseTag ? <>Running <span className="font-mono">{releaseTag}</span></> : view.title}
      description={blocked ? `${missingVariables} required environment ${missingVariables === 1 ? 'variable is' : 'variables are'} missing. Set ${missingVariables === 1 ? 'it' : 'them'} before deploying.` : view.description}
      actions={<>
        {stage === 'unconfigured' ? <Button variant="brand" size="lg" icon={Rocket} onClick={onSetup}>Deploy</Button> : null}
        {stage === 'preparing' ? <Button variant="brand" size="lg" icon={MessagesSquare} onClick={onOpenChat}>Continue in chat</Button> : null}
        {stage === 'deploying' ? <Button variant="brand" size="lg" icon={Terminal} onClick={onOpenConsole}>Watch the console</Button> : null}
        {stage === 'failed' ? <Button variant="secondary" size="lg" icon={Sparkles} onClick={hasChat ? onOpenChat : onFix}>Fix with agent</Button> : null}
        {blocked ? <Button variant="brand" size="lg" icon={KeyRound} onClick={onEnvironment}>Set variables</Button>
          : stage === 'ready' || stage === 'live' || stage === 'failed' ? <Button variant="brand" size="lg" icon={Rocket} onClick={onDeploy}>
            {stage === 'ready' ? 'Deploy' : stage === 'failed' ? 'Deploy again' : 'Deploy a release'}</Button> : null}
      </>}>
      {stage === 'unconfigured' || stage === 'preparing' ? <OperationSteps steps={STEPS} current={stage === 'unconfigured' ? 0 : 1} /> : null}
    </OperationStatusCard>
  );
};
