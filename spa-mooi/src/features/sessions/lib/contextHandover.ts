/** The percents offered for the context handover; the server accepts any whole percent from 10 to 95. */
export const CONTEXT_HANDOVER_PERCENTS = [20, 30, 40, 50, 60, 70, 80, 90];

/** `<select>` options for a handover percent: "Off" first, plus a stored value outside the presets. */
export const contextHandoverOptions = (current: number | null | undefined) => [
  { value: '', label: 'Off' },
  ...[...new Set([...CONTEXT_HANDOVER_PERCENTS, ...(current != null ? [current] : [])])]
    .sort((a, b) => a - b).map((percent) => ({ value: String(percent), label: `At ${percent}%` })),
];

export const parseContextHandover = (value: string): number | null => (value ? Number(value) : null);
