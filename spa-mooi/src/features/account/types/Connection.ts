import type { LucideIcon } from 'lucide-react';

export interface Connection {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  connected: boolean;
  action: string;
}
