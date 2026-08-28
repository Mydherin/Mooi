import { SignOutControls } from '@/features/auth/components/SignOutControls';
import { Card } from '@/shared/components/Card';

export const SecurityCard = () => (
  <Card className="p-6 lg:col-span-2">
    <h2 className="text-sm font-semibold tracking-tight text-ink">Security</h2>
    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
      Sign out of this device, or end every active session.
    </p>

    <div className="mt-5">
      <SignOutControls />
    </div>
  </Card>
);
