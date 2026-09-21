/** Internal provider sentinels are not assistant prose. Match whole blocks only. */
export const isProviderPlaceholder = (text: string): boolean =>
  text.trim() === '[No message content]' || text.trim() === '<no message>';
