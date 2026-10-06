import { FileCode2 } from 'lucide-react';
import { Button } from '@/shared/components/Button';

interface ProductionComposeMigrationNoticeProps {
  disabled: boolean;
  onMigrate: () => void;
}

/** Temporary transition UI; eligibility comes from the existing deployment documents. */
export const ProductionComposeMigrationNotice = ({ disabled, onMigrate }: ProductionComposeMigrationNoticeProps) => (
  <aside className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface-2 px-5 py-3 sm:px-8" aria-label="Production Compose migration">
    <FileCode2 className="size-5 shrink-0 text-brand" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-ink">Production Compose is still in Platform files</p>
      <p className="text-xs text-ink-muted">Move it to docker-compose.yml in the repository. Deployment scripts stay here; environment values stay encrypted in Mooi.</p>
    </div>
    <Button variant="secondary" size="sm" disabled={disabled} onClick={onMigrate}>Migrate Compose</Button>
  </aside>
);
