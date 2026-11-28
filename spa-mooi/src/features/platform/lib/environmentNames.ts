/** The names the platform stores: upper-case letters, digits and underscores. */
export const VARIABLE_NAME = /^[A-Z0-9_]{1,100}$/;

/** What the user typed, as a variable name: upper case, with spaces and dashes as underscores. */
export const normalizeVariableName = (typed: string): string => typed.toUpperCase().replace(/[\s-]/g, '_');

/** The stored name of a new variable: its owner's prefix is added unless it was typed already. */
export const prefixedVariableName = (prefix: string, name: string): string => (name.startsWith(prefix) ? name : `${prefix}${name}`);

/** A stored name without its `MOOI_<OWNER>_` prefix, the part people recognise. */
export const shortVariableName = (name: string): string => name.replace(/^MOOI_[A-Z]+?_/, '') || name;
