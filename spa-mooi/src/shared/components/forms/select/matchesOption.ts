import type { SelectOption } from '@/shared/components/forms/select/SelectOption';

export const matchesOption = (option: SelectOption, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [option.label, option.description, option.keywords].some((text) => text?.toLowerCase().includes(needle));
};
