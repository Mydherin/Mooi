export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Absolute deadline in epoch milliseconds, derived from the relative `expiresIn`. */
  expiresAt: number;
}
