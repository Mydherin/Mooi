import { requireEnv } from '@/config/requireEnv';

export const requirePositiveNumber = (value: string | undefined, key: string): number => {
  const parsed = Number(requireEnv(value, key));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid environment variable: ${key} must be a positive number. Check spa-mooi/.env`);
  }

  return parsed;
};
