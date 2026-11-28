import { useId, type ComponentProps, type ReactNode } from 'react';
import { Field } from '@/shared/components/forms/Field';
import { Select } from '@/shared/components/forms/select/Select';

type SelectFieldProps<T extends string> = Omit<ComponentProps<typeof Select<T>>, 'id'> & {
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  hideLabel?: boolean;
  labelAction?: ReactNode;
  fieldClassName?: string;
};

/** A `Select` in the form frame: visible label above, hint or error below, like `TextField`. */
export const SelectField = <T extends string>({ label, hint, error, required, hideLabel, labelAction, fieldClassName, ...select }: SelectFieldProps<T>) => {
  const id = useId();

  return (
    <Field htmlFor={id} hintId={`${id}-hint`} label={label} hint={hint} error={error} required={required}
      hideLabel={hideLabel} labelAction={labelAction} className={fieldClassName}>
      <Select<T> {...select} id={id} label={label} />
    </Field>
  );
};
