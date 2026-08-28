import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { findProject } from '@/features/projects/lib/findProject';
import { ChangesPanel } from '@/features/sessions/components/changes/ChangesPanel';
import { ChatPanel } from '@/features/sessions/components/chat/ChatPanel';
import { PreviewPanel } from '@/features/sessions/components/preview/PreviewPanel';
import { WorkspaceHeader } from '@/features/sessions/components/WorkspaceHeader';
import { WorkspacePaneSwitcher } from '@/features/sessions/components/WorkspacePaneSwitcher';
import { chatMessages } from '@/features/sessions/data/chatMessages';
import { findSession } from '@/features/sessions/lib/findSession';
import type { ChatMessage } from '@/features/sessions/types/ChatMessage';
import type { WorkspacePane } from '@/features/sessions/types/WorkspacePane';
import { EmptyState } from '@/shared/components/EmptyState';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import type { SegmentItem } from '@/shared/types/SegmentItem';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { cn } from '@/shared/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const stageItems: SegmentItem[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'changes', label: 'Changes' },
];

export const SessionPage = () => {
  const { projectId, sessionId } = useParams();
  const project = findProject(projectId);
  const session = findSession(projectId, sessionId);
  const activePane = useWorkspaceStore((state) => state.activePane);
  const setActivePane = useWorkspaceStore((state) => state.setActivePane);
  const [stageTab, setStageTab] = useState<WorkspacePane>('preview');
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages);

  if (!project || !session) {
    return (
      <div className="px-4 py-8 lg:px-6">
        <EmptyState
          icon={Compass}
          title="Session not found"
          description="This session is not part of your workspace."
        >
          <Link to={ROUTES.projects} className={buttonStyles('secondary', 'md')}>
            Back to projects
          </Link>
        </EmptyState>
      </div>
    );
  }

  const stagePane = activePane === 'chat' ? stageTab : activePane;

  const handleSend = (text: string) => {
    const time = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    setMessages((current) => [
      ...current,
      { id: `local-${current.length}-user`, role: 'user', author: 'You', time, text },
      {
        id: `local-${current.length}-system`,
        role: 'system',
        author: 'Mooi',
        time,
        text: 'The agent provider is not connected in this preview.',
      },
    ]);
  };

  const handleStageChange = (id: string) => {
    const pane = id as WorkspacePane;

    setStageTab(pane);

    if (activePane !== 'chat') {
      setActivePane(pane);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkspaceHeader project={project} session={session} />

      <div className="shrink-0 border-b border-line px-4 py-2 lg:hidden">
        <WorkspacePaneSwitcher />
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[1fr] lg:grid-cols-[minmax(360px,36%)_1fr]">
        <div
          className={cn(
            'min-w-0 min-h-0 flex-col border-line lg:flex lg:border-r',
            activePane === 'chat' ? 'flex' : 'hidden',
          )}
        >
          <ChatPanel messages={messages} onSend={handleSend} />
        </div>

        <div
          className={cn(
            'min-w-0 min-h-0 flex-col lg:flex',
            activePane === 'chat' ? 'hidden' : 'flex',
          )}
        >
          <div className="hidden h-12 shrink-0 items-center border-b border-line px-4 lg:flex">
            <SegmentedControl items={stageItems} value={stagePane} onChange={handleStageChange} />
          </div>

          <div className="min-h-0 flex-1">
            {stagePane === 'preview' ? <PreviewPanel /> : <ChangesPanel />}
          </div>
        </div>
      </div>
    </div>
  );
};
