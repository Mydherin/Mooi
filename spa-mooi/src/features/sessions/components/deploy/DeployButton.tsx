import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { DeployDialog } from '@/features/sessions/components/deploy/DeployDialog';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/Button';

interface DeployButtonProps {
  session: Session;
}

export const DeployButton = ({ session }: DeployButtonProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
        <Rocket className="size-4" />
        Deploy
      </Button>

      <DeployDialog open={open} onClose={() => setOpen(false)} branch={session.branch} />
    </>
  );
};
