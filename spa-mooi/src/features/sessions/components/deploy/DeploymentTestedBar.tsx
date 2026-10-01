import { Eraser } from 'lucide-react';
import { ChatCompletionBar } from '@/features/sessions/components/chat/ChatCompletionBar';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/Button';

interface DeploymentTestedBarProps {
  session: Session;
  busy: boolean;
  onClear: () => Promise<boolean>;
}

/** Once the agent's setup passed its test the deployment is live: clearing the chat gets back to iterating. */
export const DeploymentTestedBar = ({ session, busy, onClear }: DeploymentTestedBarProps) => {
  if (session.deploymentSetup !== 'tested' || session.status !== 'ready' || session.pending) return null;
  return (
    <ChatCompletionBar title="Deployment tested and live." description="Clear the chat to keep iterating on this session.">
      <Button variant="brand" size="sm" disabled={busy} onClick={() => void onClear()}><Eraser className="size-4" />Clear chat</Button>
    </ChatCompletionBar>
  );
};
