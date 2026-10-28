import { env } from '@/config/env';
import type { RevokedSessionsResponse } from '@/features/auth/types/RevokedSessionsResponse';
import type { SessionResponse } from '@/features/auth/types/SessionResponse';

const jsonHeaders = { 'Content-Type': 'application/json' } as const;

/** A failed auth call; `status` tells a suspended account (403) apart from any other failure. */
export class AuthRequestError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`Request to ${path} failed with ${status}`);
    this.status = status;
  }
}

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  const response = await fetch(`${env.apiBaseUrl}${path}`, init);

  if (!response.ok) {
    throw new AuthRequestError(path, response.status);
  }

  return (await response.json()) as T;
};

export const loginWithGoogle = (idToken: string): Promise<SessionResponse> =>
  request('/auth/google', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ idToken }),
  });

export const refreshSession = (refreshToken: string): Promise<SessionResponse> =>
  request('/auth/refresh', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ refreshToken }),
  });

export const logout = async (refreshToken: string): Promise<void> => {
  const response = await fetch(`${env.apiBaseUrl}/auth/logout`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error(`Request to /auth/logout failed with ${response.status}`);
  }
};

export const logoutEverywhere = (accessToken: string): Promise<RevokedSessionsResponse> =>
  request('/auth/logout-all', {
    method: 'POST',
    headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}` },
  });
