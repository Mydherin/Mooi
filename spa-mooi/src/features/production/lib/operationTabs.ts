import { Activity, FileCode2, GitCompareArrows, LayoutDashboard, MessagesSquare, Terminal } from 'lucide-react';
import type { Session } from '@/features/sessions/types/Session';
import type { TabItem } from '@/shared/types/TabItem';

interface OperationTabsInput {
  chat: Session | undefined;
  /** Set once the chat finished its job: the tab offers to close it. */
  onCloseChat?: () => void;
  closeChatLabel: string;
  /** The live operation, if one ran since the service started. */
  operationId: string | null;
  running: boolean;
  showFiles: boolean;
  pendingFiles: number;
  repositoryChanges: number;
}

const chatBusy = (chat: Session): boolean => chat.status === 'working' || chat.status === 'waiting' || chat.status === 'provisioning';

/** The views that are relevant right now: the chat and its changes and trace only while a chat lives, the console once something ran. */
export const operationTabs = ({ chat, onCloseChat, closeChatLabel, operationId, running, showFiles, pendingFiles, repositoryChanges }: OperationTabsInput): TabItem[] => [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  ...(chat ? [{ id: 'chat', label: 'Chat', icon: MessagesSquare, dot: chatBusy(chat), ...(onCloseChat ? { onClose: onCloseChat, closeLabel: closeChatLabel } : {}) }] : []),
  ...(operationId ? [{ id: 'console', label: 'Console', icon: Terminal, dot: running }] : []),
  ...(showFiles ? [{ id: 'files', label: 'Platform files', icon: FileCode2, count: pendingFiles || undefined }] : []),
  ...(chat ? [{ id: 'changes', label: 'Changes', icon: GitCompareArrows, count: repositoryChanges || undefined },
    { id: 'trace', label: 'Trace', icon: Activity }] : []),
];
