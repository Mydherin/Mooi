export const requireEnv = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}. Check spa-mooi/.env`);
  }

  return value;
};
