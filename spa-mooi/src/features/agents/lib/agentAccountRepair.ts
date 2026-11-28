import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { AgentProvider } from '@/features/agents/types/AgentProvider';

/** The provider links accounts through its own sign-in (Claude OAuth or a device code). */
export const providerSignsIn = (provider: AgentProvider | undefined): boolean =>
  Boolean(provider && (provider.oauthEnabled || provider.modes.includes('device_oauth')));

/** A pasted `claude setup-token` token is deprecated wherever the provider's sign-in is offered. */
export const usesLegacyToken = (connection: AgentConnection, provider: AgentProvider | undefined): boolean =>
  connection.mode === 'setup_token' && Boolean(provider?.oauthEnabled);

/** An ended sign-in or a deprecated setup token, repaired in place by signing in again. */
export const canSignInAgain = (connection: AgentConnection, provider: AgentProvider | undefined): boolean =>
  providerSignsIn(provider) && (connection.stale || usesLegacyToken(connection, provider));
