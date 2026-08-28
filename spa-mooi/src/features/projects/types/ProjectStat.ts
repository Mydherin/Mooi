import type { LucideIcon } from 'lucide-react';

export interface ProjectStat {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}
