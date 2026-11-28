import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Field } from '@/shared/components/forms/Field';
import { fieldControl } from '@/shared/components/forms/fieldStyles';
import { cn } from '@/shared/utils/cn';

interface TextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  /** Visible rows before it grows; it grows with its content up to `maxRows`, then scrolls. */
  rows?: number;
  maxRows?: number;
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'send';
  autoFocus?: boolean;
  hideLabel?: boolean;
  labelAction?: ReactNode;
  mono?: boolean;
  id?: string;
  className?: string;
}

const LINE = 22;

/** A labelled multi-line input that grows with its content (16 px text, no iOS zoom). */
export const TextArea = ({ label, value, onChange, placeholder, hint, error, required, disabled, maxLength, rows = 3, maxRows = 12,
  enterKeyHint, autoFocus, hideLabel, labelAction, mono = false, id, className }: TextAreaProps) => {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const element = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight + 2, maxRows * LINE + 24)}px`;
  }, [value, maxRows]);

  return (
    <Field htmlFor={inputId} label={label} hint={hint} error={error} hintId={hintId} required={required} hideLabel={hideLabel}
      labelAction={labelAction} className={className}>
      <textarea
        ref={element}
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
        enterKeyHint={enterKeyHint}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? hintId : undefined}
        className={cn(fieldControl, 'resize-none overscroll-contain py-3 leading-[22px]', mono && 'font-mono text-[14px]')}
      />
    </Field>
  );
};
