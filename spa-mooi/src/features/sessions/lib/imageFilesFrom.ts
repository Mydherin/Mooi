/** Image files carried by a paste or drop; screenshots on the clipboard arrive as unnamed files. */
export const imageFilesFrom = (data: DataTransfer | null): File[] =>
  Array.from(data?.files ?? []).filter((file) => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name));
