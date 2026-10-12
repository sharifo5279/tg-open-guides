/**
 * Per-request context, so the shared layout can render the signed-in state
 * without every page renderer having to carry the account through.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export const requestContext = new AsyncLocalStorage();

export function currentAccount() {
  return requestContext.getStore()?.account ?? null;
}
