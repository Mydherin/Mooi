import { CircleAlert, CircleCheck, CircleDashed, LoaderCircle, Rocket, Sparkles, type LucideIcon } from 'lucide-react';
import type { ProductionStage } from '@/features/production/types/ProductionStage';
import type { Tone } from '@/shared/types/Tone';

interface ProductionStageView {
  label: string;
  tone: Tone;
  icon: LucideIcon;
  title: string;
  description: string;
}

export const PRODUCTION_STAGE_VIEWS: Record<ProductionStage, ProductionStageView> = {
  unconfigured: {
    label: 'Not configured', tone: 'neutral', icon: CircleDashed, title: 'No production deployment yet',
    description: 'Describe how this project reaches production. An agent prepares DEPLOYMENT.md, deploy.sh and status.sh with you, asking for anything it needs.',
  },
  preparing: {
    label: 'Preparing', tone: 'info', icon: Sparkles, title: 'The agent is preparing the deployment',
    description: 'Answer its questions in the chat. Deploy becomes available as soon as the configuration is saved.',
  },
  ready: {
    label: 'Ready to deploy', tone: 'brand', icon: Rocket, title: 'Ready for production',
    description: 'The configuration is saved. Deploy a GitHub release to take it live.',
  },
  deploying: {
    label: 'Deploying', tone: 'info', icon: LoaderCircle, title: 'Deployment in progress',
    description: 'deploy.sh is running against the selected release. Follow its output in the console.',
  },
  live: {
    label: 'Live', tone: 'success', icon: CircleCheck, title: 'Running in production',
    description: 'The last deployment succeeded. Status checks run periodically while this page is open.',
  },
  failed: {
    label: 'Deployment failed', tone: 'danger', icon: CircleAlert, title: 'The last deployment failed',
    description: 'Review the output and let the agent adjust the configuration, then deploy again.',
  },
};
