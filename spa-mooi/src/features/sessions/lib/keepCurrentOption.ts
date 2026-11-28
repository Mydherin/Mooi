import type { SelectOption } from '@/shared/components/forms/select/SelectOption';

/** The options, plus the current value as an extra one when the list no longer offers it, so it stays visible. */
export const keepCurrentOption = (options: SelectOption[], value: string): SelectOption[] =>
  value && !options.some((option) => option.value === value) ? [{ value, label: value }, ...options] : options;
