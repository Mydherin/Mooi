import { Link } from 'react-router-dom';
import type { ActionItem } from '@/shared/components/actions/ActionItem';
import { Button } from '@/shared/components/actions/Button';
import { Menu } from '@/shared/components/overlays/menu/Menu';
import { useIsPhone } from '@/shared/hooks/useIsPhone';
import { buttonStyles } from '@/shared/styles/buttonStyles';

interface ResponsiveActionsProps {
  actions: ActionItem[];
  /** Name of the overflow menu. */
  label?: string;
  /** Buttons shown inline from `sm` before the rest collapse into the menu. */
  maxInline?: number;
}

const InlineAction = ({ action }: { action: ActionItem }) => {
  const Icon = action.icon;
  const variant = action.variant ?? 'secondary';
  if (action.to && !action.disabled) {
    return (
      <Link to={action.to} state={action.linkState} className={buttonStyles(variant, 'sm')}>
        {Icon ? <Icon aria-hidden className="size-4" /> : null}{action.label}
      </Link>
    );
  }
  return (
    <Button variant={variant} size="sm" icon={Icon} loading={action.loading} disabled={action.disabled}
      onClick={() => (action.href ? window.open(action.href, '_blank', 'noopener,noreferrer') : action.onSelect?.())}>
      {action.label}
    </Button>
  );
};

/**
 * Header actions that fit any width: on phones only the `primary` ones stay buttons and the rest
 * go into a "more" menu (an action sheet); from `sm`, up to `maxInline` non-destructive actions
 * are buttons and the rest (destructive ones always) go into the menu. Same items, one source.
 */
export const ResponsiveActions = ({ actions, label = 'More actions', maxInline = 2 }: ResponsiveActionsProps) => {
  const phone = useIsPhone();
  const visible = actions.filter((action) => !action.hidden);
  const candidates = visible.filter((action) => (phone ? action.primary : !action.destructive));
  const inline = phone ? candidates : candidates.slice(0, Math.max(maxInline, visible.filter((action) => action.primary).length));
  const overflow = visible.filter((action) => !inline.includes(action));

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {inline.map((action) => <InlineAction key={action.id} action={action} />)}
      {overflow.length > 0 ? (
        <Menu label={label} sections={[
          { id: 'actions', items: overflow.filter((action) => !action.destructive) },
          { id: 'destructive', items: overflow.filter((action) => action.destructive) },
        ]} />
      ) : null}
    </div>
  );
};
