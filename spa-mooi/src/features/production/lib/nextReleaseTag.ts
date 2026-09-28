/** Suggests the next patch version after the newest semantic tag, keeping its `v` prefix. */
export const nextReleaseTag = (latest: string | undefined): string => {
  const match = latest?.match(/^(v?)(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return latest ? '' : 'v1.0.0';
  return `${match[1]}${match[2]}.${match[3]}.${Number(match[4]) + 1}`;
};
