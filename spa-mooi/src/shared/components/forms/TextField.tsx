import { useId, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { Field } from '@/shared/components/forms/Field';
import { fieldControl } from '@/shared/components/forms/fieldStyles';
import { cn } from '@/shared/utils/cn';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Always set it: it picks the right keyboard (`email`, `url`, `search`, `password`, `tel`, `number`). */
  type?: 'text' | 'email' | 'url' | 'search' | 'password' | 'tel' | 'number';
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  /** The keyboard's action key: `next` between fields, `done`/`go`/`send`/`search` on the last one. */
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  autoComplete?: string;
  autoCapitalize?: 'off' | 'none' | 'sentences' | 'words' | 'characters';
  spellCheck?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  name?: string;
  id?: string;
  autoFocus?: boolean;
  hideLabel?: boolean;
  labelAction?: ReactNode;
  /** Content inside the field, before or after the text (an icon, a unit, a reveal button). */
  leading?: ReactNode;
  trailing?: ReactNode;
  mono?: boolean;
  onBlur?: () => void;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

/** A labelled single-line input with hint and error. Its text is 16 px, so iOS never zooms into it. */
export const TextField = ({ label, value, onChange, type = 'text', inputMode, enterKeyHint, autoComplete, autoCapitalize, spellCheck,
  placeholder, hint, error, required, disabled, readOnly, maxLength, name, id, autoFocus, hideLabel, labelAction, leading, trailing,
  mono = false, onBlur, className, ref }: TextFieldProps) => {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;

  return (
    <Field htmlFor={inputId} label={label} hint={hint} error={error} hintId={hintId} required={required} hideLabel={hideLabel}
      labelAction={labelAction} className={className}>
      <div className="relative flex min-w-0 items-center">
        {leading ? <span className="pointer-events-none absolute left-3.5 flex text-ink-subtle">{leading}</span> : null}
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize ?? (type === 'text' ? undefined : 'none')}
          autoCorrect={type === 'text' ? undefined : 'off'}
          spellCheck={spellCheck}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? hintId : undefined}
          className={cn(fieldControl, 'h-12 sm:h-11', Boolean(leading) && 'pl-10', Boolean(trailing) && 'pr-11', mono && 'font-mono')}
        />
        {trailing ? <span className="absolute right-1.5 flex">{trailing}</span> : null}
      </div>
    </Field>
  );
};
