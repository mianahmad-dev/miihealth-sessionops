// Maps DB session IDs to voice provider session IDs.
// Module-level singleton — persists for the lifetime of the Node.js process.
const registry = new Map<string, string>();

export function registerSession(dbSessionId: string, providerSessionId: string): void {
  registry.set(dbSessionId, providerSessionId);
}

export function getProviderSessionId(dbSessionId: string): string | undefined {
  return registry.get(dbSessionId);
}

export function unregisterSession(dbSessionId: string): void {
  registry.delete(dbSessionId);
}
