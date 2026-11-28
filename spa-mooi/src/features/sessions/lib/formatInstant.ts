/** A local time from epoch seconds, short enough for a phone line: "15:20", or "Sat 28, 15:20" when not today. */
export const formatInstant = (epochSeconds: number): string => {
  const date = new Date(epochSeconds * 1000);
  const today = date.toDateString() === new Date().toDateString();
  return date.toLocaleString(undefined, today ? { hour: '2-digit', minute: '2-digit' }
    : { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
