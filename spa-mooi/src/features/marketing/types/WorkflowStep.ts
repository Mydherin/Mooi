import type { LucideIcon } from 'lucide-react';

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}
