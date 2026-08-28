import { ChevronDown } from 'lucide-react';
import type { FaqEntry } from '@/features/marketing/types/FaqEntry';
import { Card } from '@/shared/components/Card';

interface FaqItemProps {
  entry: FaqEntry;
}

export const FaqItem = ({ entry }: FaqItemProps) => (
  <Card as="li" className="p-5">
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        {entry.question}
        <ChevronDown className="size-4 shrink-0 text-ink-subtle transition duration-200 group-open:rotate-180" />
      </summary>

      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{entry.answer}</p>
    </details>
  </Card>
);
